using System;
using System.Security.Cryptography;
using System.Text;

namespace SizzleStreet.Save
{
    /// <summary>Turns a <see cref="SaveData"/> into bytes on disk, and back.</summary>
    /// <remarks>
    /// The pipeline is JSON, then a checksum over the plaintext, then AES.
    ///
    /// The encryption is obfuscation, not security, and it is important that everyone reading
    /// this knows the difference. The key ships inside the application; a determined player
    /// will extract it. It exists to make casual save editing inconvenient enough that most
    /// people do not bother. Nothing that gates a purchase may trust it — entitlements come
    /// from the store, every launch.
    ///
    /// The checksum earns its place for a duller reason than tampering: it catches truncation.
    /// A process killed mid-write leaves a partial file, and without a checksum that file
    /// deserialises into a plausible-looking save with a player's progress silently missing.
    /// </remarks>
    public interface ISaveSerializer
    {
        byte[] Serialize(SaveData data);

        /// <summary>Reads bytes back. Returns false if they are corrupt, truncated or edited.</summary>
        bool TryDeserialize(byte[] payload, out SaveData data, out string failureReason);
    }

    /// <summary>Serialises to JSON via the injected codec, then checksums and encrypts.</summary>
    public sealed class SaveSerializer : ISaveSerializer
    {
        private const int KeySizeBytes = 32;
        private const int IvSizeBytes = 16;

        private readonly IJsonCodec _json;
        private readonly byte[] _key;

        /// <param name="json">JSON codec. Newtonsoft in the game; anything in tests.</param>
        /// <param name="keyMaterial">
        /// Key seed. Derived per install rather than being a single global constant, so that
        /// extracting one player's key does not unlock every save file in the world.
        /// </param>
        public SaveSerializer(IJsonCodec json, string keyMaterial)
        {
            _json = json ?? throw new ArgumentNullException(nameof(json));
            if (string.IsNullOrEmpty(keyMaterial))
            {
                throw new ArgumentException("Key material is required.", nameof(keyMaterial));
            }

            using var sha = SHA256.Create();
            _key = sha.ComputeHash(Encoding.UTF8.GetBytes(keyMaterial));
        }

        public byte[] Serialize(SaveData data)
        {
            if (data == null)
            {
                throw new ArgumentNullException(nameof(data));
            }

            var json = _json.Serialize(data);
            var plaintext = Encoding.UTF8.GetBytes(json);
            var checksum = Checksum(plaintext);

            // Layout: [checksum 32][iv 16][ciphertext]. The checksum covers the plaintext, so
            // it verifies the decrypted content rather than the file, which is what catches a
            // successful decrypt of deliberately altered data.
            using var aes = Aes.Create();
            aes.Key = _key;
            aes.GenerateIV();
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;

            using var encryptor = aes.CreateEncryptor();
            var ciphertext = encryptor.TransformFinalBlock(plaintext, 0, plaintext.Length);

            var output = new byte[checksum.Length + IvSizeBytes + ciphertext.Length];
            Buffer.BlockCopy(checksum, 0, output, 0, checksum.Length);
            Buffer.BlockCopy(aes.IV, 0, output, checksum.Length, IvSizeBytes);
            Buffer.BlockCopy(ciphertext, 0, output, checksum.Length + IvSizeBytes, ciphertext.Length);
            return output;
        }

        public bool TryDeserialize(byte[] payload, out SaveData data, out string failureReason)
        {
            data = null;
            failureReason = null;

            if (payload == null || payload.Length <= KeySizeBytes + IvSizeBytes)
            {
                failureReason = "truncated";
                return false;
            }

            try
            {
                var expected = new byte[KeySizeBytes];
                Buffer.BlockCopy(payload, 0, expected, 0, KeySizeBytes);

                var iv = new byte[IvSizeBytes];
                Buffer.BlockCopy(payload, KeySizeBytes, iv, 0, IvSizeBytes);

                var cipherLength = payload.Length - KeySizeBytes - IvSizeBytes;
                var ciphertext = new byte[cipherLength];
                Buffer.BlockCopy(payload, KeySizeBytes + IvSizeBytes, ciphertext, 0, cipherLength);

                using var aes = Aes.Create();
                aes.Key = _key;
                aes.IV = iv;
                aes.Mode = CipherMode.CBC;
                aes.Padding = PaddingMode.PKCS7;

                using var decryptor = aes.CreateDecryptor();
                var plaintext = decryptor.TransformFinalBlock(ciphertext, 0, ciphertext.Length);

                if (!FixedTimeEquals(expected, Checksum(plaintext)))
                {
                    failureReason = "checksum";
                    return false;
                }

                var json = Encoding.UTF8.GetString(plaintext);
                data = _json.Deserialize<SaveData>(json);
                if (data == null)
                {
                    failureReason = "empty";
                    return false;
                }

                return true;
            }
            catch (CryptographicException)
            {
                // Wrong key, or bytes altered so padding no longer validates.
                failureReason = "decrypt";
                return false;
            }
            catch (Exception exception)
            {
                // A malformed save must never take the game down with it. Whatever went wrong,
                // the answer is the same: fall back to the backup slot.
                failureReason = exception.GetType().Name;
                return false;
            }
        }

        private static byte[] Checksum(byte[] plaintext)
        {
            using var sha = SHA256.Create();
            return sha.ComputeHash(plaintext);
        }

        private static bool FixedTimeEquals(byte[] left, byte[] right)
        {
            if (left.Length != right.Length)
            {
                return false;
            }

            var difference = 0;
            for (var i = 0; i < left.Length; i++)
            {
                difference |= left[i] ^ right[i];
            }

            return difference == 0;
        }
    }

    /// <summary>JSON, behind an interface so the save layer does not depend on Newtonsoft.</summary>
    public interface IJsonCodec
    {
        string Serialize<T>(T value);

        T Deserialize<T>(string json);
    }
}
