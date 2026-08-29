using System;
using System.IO;
using SizzleStreet.Save;

namespace SizzleStreet.Android
{
    /// <summary>Stores saves as files in the app's private directory.</summary>
    /// <remarks>
    /// Writes atomically — to a temporary file, flushed to disk, then moved over the live one.
    /// Android kills backgrounded processes without warning, and a half-written save is the one
    /// failure that costs a player everything they have.
    /// </remarks>
    public sealed class AndroidFileSaveStore : ISaveStore
    {
        private readonly string _directory;

        public AndroidFileSaveStore(string directory)
        {
            _directory = directory ?? throw new ArgumentNullException(nameof(directory));
            Directory.CreateDirectory(_directory);
        }

        public bool Exists(string slot) => File.Exists(PathFor(slot));

        public byte[] Read(string slot)
        {
            var path = PathFor(slot);
            return File.Exists(path) ? File.ReadAllBytes(path) : null;
        }

        public void Write(string slot, byte[] payload)
        {
            if (payload == null)
            {
                return;
            }

            var path = PathFor(slot);
            var temporary = path + ".tmp";

            using (var stream = new FileStream(temporary, FileMode.Create, FileAccess.Write))
            {
                stream.Write(payload, 0, payload.Length);
                stream.Flush(true);
            }

            if (File.Exists(path))
            {
                File.Delete(path);
            }

            File.Move(temporary, path);
        }

        public void Delete(string slot)
        {
            var path = PathFor(slot);
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }

        private string PathFor(string slot) => Path.Combine(_directory, slot + ".dat");
    }
}
