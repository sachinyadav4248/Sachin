using SizzleStreet.Core;
using SizzleStreet.Simulation;
using UnityEngine;

namespace SizzleStreet.Gameplay
{
    /// <summary>
    /// Moves the avatar and works whatever it is standing next to.
    /// </summary>
    /// <remarks>
    /// <para>
    /// There is no interaction button. Everything is proximity-triggered: walk to a station and
    /// you work it, walk to the counter and you serve it, walk over cash and you collect it.
    /// That is what makes one-handed play on a bus possible, and it is a hard requirement
    /// rather than a convenience — the primary persona plays with one thumb, standing up.
    /// </para>
    /// <para>
    /// This class owns no rules. It reads the joystick, moves a transform, and tells the
    /// simulation who is near what. Every decision about production, serving and payment
    /// belongs to <see cref="Shop"/>, which is why that class can be tested without a scene.
    /// </para>
    /// </remarks>
    [RequireComponent(typeof(CharacterController))]
    public sealed class PlayerController : MonoBehaviour
    {
        [Header("Movement")]
        [SerializeField]
        private float _moveSpeed = 5.5f;

        [SerializeField]
        private float _turnSpeed = 18f;

        [Header("Interaction")]
        [SerializeField]
        private float _interactionRadius = 1.6f;

        [SerializeField]
        private LayerMask _interactableLayers = ~0;

        /// <summary>
        /// Reused for every proximity query so the core loop allocates nothing.
        /// </summary>
        /// <remarks>
        /// <c>OverlapSphere</c> allocates an array per call; the non-allocating variant fills
        /// this one instead. At sixty frames a second that is the difference between a steady
        /// drip of garbage and none.
        /// </remarks>
        private readonly Collider[] _overlapBuffer = new Collider[16];

        private CharacterController _character;
        private Transform _transform;
        private CarryStack _stack;
        private Shop _shop;
        private IJoystick _joystick;
        private Vector3 _velocity;

        public CarryStack Stack => _stack;

        private void Awake()
        {
            // Cached here rather than fetched per frame: GetComponent in Update is one of the
            // few things that reliably shows up in a mid-tier device's frame graph.
            _character = GetComponent<CharacterController>();
            _transform = transform;
        }

        /// <summary>Wires the controller to the simulation. Called by the location loader.</summary>
        public void Bind(Shop shop, CarryStack stack, IJoystick joystick)
        {
            _shop = shop;
            _stack = stack;
            _joystick = joystick;
        }

        private void Update()
        {
            if (_shop == null || _joystick == null)
            {
                return;
            }

            var delta = Time.deltaTime;
            Move(delta);
            UpdateProximity();
        }

        private void Move(float delta)
        {
            var input = _joystick.Direction;
            var move = new Vector3(input.x, 0f, input.y);

            // Clamped rather than normalised, so a joystick pushed halfway walks at half speed.
            // Normalising would make every touch full speed and lose all fine control.
            if (move.sqrMagnitude > 1f)
            {
                move.Normalize();
            }

            _velocity = move * _moveSpeed;
            _character.SimpleMove(_velocity);

            if (move.sqrMagnitude > 0.001f)
            {
                var facing = Quaternion.LookRotation(move, Vector3.up);
                _transform.rotation =
                    Quaternion.Slerp(_transform.rotation, facing, delta * _turnSpeed);
            }
        }

        /// <summary>
        /// Tells the simulation which posts the player is currently covering.
        /// </summary>
        /// <remarks>
        /// Every station is cleared first and then re-marked. Marking only what is in range
        /// would leave a station believing the player is still there after they walk away,
        /// which shows up as a shop that keeps producing from an empty room.
        /// </remarks>
        private void UpdateProximity()
        {
            for (var i = 0; i < _shop.Chain.Count; i++)
            {
                _shop.Chain[i].PlayerPresent = false;
            }

            var count = Physics.OverlapSphereNonAlloc(
                _transform.position, _interactionRadius, _overlapBuffer, _interactableLayers);

            for (var i = 0; i < count; i++)
            {
                var hit = _overlapBuffer[i];
                if (hit == null)
                {
                    continue;
                }

                if (hit.TryGetComponent<StationAnchor>(out var stationAnchor))
                {
                    stationAnchor.Station.PlayerPresent = true;
                    _shop.CollectFinished(_stack);
                    continue;
                }

                if (hit.TryGetComponent<CounterAnchor>(out var counterAnchor))
                {
                    _shop.Serve(counterAnchor.Counter, _stack);
                    continue;
                }

                if (hit.TryGetComponent<StaffAnchor>(out var staffAnchor))
                {
                    staffAnchor.Worker.Wake();
                }
            }
        }
    }

    /// <summary>The joystick, behind an interface so the controller can be driven by a test.</summary>
    public interface IJoystick
    {
        /// <summary>Stick direction, magnitude 0 to 1.</summary>
        Vector2 Direction { get; }
    }

    /// <summary>Links a collider in the scene to a station in the simulation.</summary>
    public sealed class StationAnchor : MonoBehaviour
    {
        public Station Station { get; set; }
    }

    /// <summary>Links a collider in the scene to a serving channel.</summary>
    public sealed class CounterAnchor : MonoBehaviour
    {
        public ServiceCounter Counter { get; set; }
    }

    /// <summary>Links a collider in the scene to a hired worker, so bumping them wakes them.</summary>
    public sealed class StaffAnchor : MonoBehaviour
    {
        public StaffWorker Worker { get; set; }
    }
}
