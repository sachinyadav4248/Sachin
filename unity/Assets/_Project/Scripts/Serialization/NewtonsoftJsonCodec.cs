using Newtonsoft.Json;
using SizzleStreet.Save;

namespace SizzleStreet.Serialization
{
    /// <summary>
    /// The shipping JSON codec, kept in its own assembly.
    /// </summary>
    /// <remarks>
    /// <see cref="SizzleStreet.Save"/> declares <see cref="IJsonCodec"/> and never references
    /// Newtonsoft, so the save logic stays testable without a JSON library and portable if the
    /// library is ever replaced. This assembly is the single place the dependency lands.
    /// </remarks>
    public sealed class NewtonsoftJsonCodec : IJsonCodec
    {
        private readonly JsonSerializerSettings _settings = new JsonSerializerSettings
        {
            // Compact: this runs on autosave, and a save is written far more often than read.
            Formatting = Formatting.None,

            // Defaults are written explicitly rather than omitted. An omitted field
            // deserialises to the C# default, which is not always the game's default, and the
            // difference only shows up in someone's save months later.
            DefaultValueHandling = DefaultValueHandling.Include,
            NullValueHandling = NullValueHandling.Include,

            // No type names in the payload. Save files are attacker-controlled input, and
            // type-name handling turns deserialisation into arbitrary type construction.
            TypeNameHandling = TypeNameHandling.None,

            MissingMemberHandling = MissingMemberHandling.Ignore
        };

        public string Serialize<T>(T value) => JsonConvert.SerializeObject(value, _settings);

        public T Deserialize<T>(string json) => JsonConvert.DeserializeObject<T>(json, _settings);
    }
}
