using System;
using Android.Content;
using Android.Graphics;
using Android.Views;
using SizzleStreet.Core;
using SizzleStreet.Simulation;

namespace SizzleStreet.Android
{
    /// <summary>
    /// Draws the shop and reads the joystick.
    /// </summary>
    /// <remarks>
    /// Everything here is deliberately disposable. Coloured rectangles stand in for the
    /// low-poly art the design calls for, and the whole class exists to answer one question as
    /// cheaply as possible: is the loop fun to play? If the answer is yes this gets replaced by
    /// a Unity scene; if it is no, nothing of value was spent finding out.
    ///
    /// Frame pacing comes from <c>PostInvalidateOnAnimation</c>, which is vsync-driven, so this
    /// runs at the display's refresh rate without a render thread to get wrong.
    /// </remarks>
    public sealed class GameView : View
    {
        private const float JoystickBandTop = 0.845f;
        private const float ButtonsTop = 0.66f;

        private readonly GameWorld _world;
        private readonly Paint _fill = new Paint(PaintFlags.AntiAlias);
        private readonly Paint _text = new Paint(PaintFlags.AntiAlias);
        private readonly Paint _stroke = new Paint(PaintFlags.AntiAlias);
        private readonly RectF[] _buttonBounds;

        private long _lastFrameNanos;
        private float _moveX;
        private float _moveY;
        private int _joystickPointer = -1;
        private float _joystickOriginX;
        private float _joystickOriginY;
        private float _joystickKnobX;
        private float _joystickKnobY;
        private double _bannerSeconds = 6.0;

        public GameView(Context context, GameWorld world) : base(context)
        {
            _world = world ?? throw new ArgumentNullException(nameof(world));
            _buttonBounds = new RectF[world.Buttons.Count];
            for (var i = 0; i < _buttonBounds.Length; i++)
            {
                _buttonBounds[i] = new RectF();
            }

            _stroke.SetStyle(Paint.Style.Stroke);
            _text.TextAlign = Paint.Align.Center;
        }

        /// <summary>Seconds the last frame took. The clock reads this.</summary>
        public float LastDelta { get; private set; }

        /// <summary>Seconds since the view started drawing.</summary>
        public double SessionSeconds { get; private set; }

        protected override void OnSizeChanged(int width, int height, int oldWidth, int oldHeight)
        {
            base.OnSizeChanged(width, height, oldWidth, oldHeight);
            LayoutButtons(width, height);
        }

        private void LayoutButtons(int width, int height)
        {
            const int firstRow = 4;
            var top = height * ButtonsTop;
            var rowHeight = (height * (JoystickBandTop - ButtonsTop)) / 2f;
            var pad = width * 0.012f;

            for (var i = 0; i < _buttonBounds.Length; i++)
            {
                var row = i < firstRow ? 0 : 1;
                var columns = row == 0 ? firstRow : Math.Max(1, _buttonBounds.Length - firstRow);
                var column = row == 0 ? i : i - firstRow;
                var cellWidth = width / (float)columns;

                _buttonBounds[i].Set(
                    column * cellWidth + pad,
                    top + row * rowHeight + pad,
                    (column + 1) * cellWidth - pad,
                    top + (row + 1) * rowHeight - pad);
            }
        }

        protected override void OnDraw(Canvas canvas)
        {
            base.OnDraw(canvas);

            var now = Java.Lang.JavaSystem.NanoTime();
            if (_lastFrameNanos == 0)
            {
                _lastFrameNanos = now;
            }

            LastDelta = (float)((now - _lastFrameNanos) / 1_000_000_000.0);
            _lastFrameNanos = now;
            SessionSeconds += LastDelta;
            _bannerSeconds -= LastDelta;

            _world.Update(LastDelta, _moveX, _moveY);

            canvas.DrawColor(Color.ParseColor("#171A1F"));
            DrawShopFloor(canvas);
            DrawCrate(canvas);
            DrawStations(canvas);
            DrawCounters(canvas);
            DrawPlayer(canvas);
            DrawHud(canvas);
            DrawButtons(canvas);
            DrawJoystick(canvas);

            PostInvalidateOnAnimation();
        }

        // ------------------------------------------------------------------------------
        // Drawing
        // ------------------------------------------------------------------------------

        private void DrawShopFloor(Canvas canvas)
        {
            _fill.Color = Color.ParseColor("#20242C");
            canvas.DrawRect(0, Height * 0.11f, Width, Height * ButtonsTop, _fill);
        }

        private void DrawCrate(Canvas canvas)
        {
            var x = _world.Crate.X * Width;
            var y = _world.Crate.Y * Height;
            var size = Width * 0.045f;

            _fill.Color = Color.ParseColor("#7A5C33");
            canvas.DrawRect(x - size, y - size, x + size, y + size, _fill);

            _text.Color = Color.ParseColor("#E8DCC8");
            _text.TextSize = Width * 0.028f;
            canvas.DrawText("SUPPLIES", x, y + size * 1.9f, _text);
        }

        private void DrawStations(Canvas canvas)
        {
            var halfWidth = Width * 0.095f;
            var halfHeight = Height * 0.045f;

            foreach (var slot in _world.Stations)
            {
                var x = slot.Position.X * Width;
                var y = slot.Position.Y * Height;
                var station = slot.Station;

                _fill.Color = Color.ParseColor(ColourFor(station.State));
                canvas.DrawRoundRect(
                    new RectF(x - halfWidth, y - halfHeight, x + halfWidth, y + halfHeight),
                    16f, 16f, _fill);

                // Progress toward the next item, so the chain's pacing is visible.
                _fill.Color = Color.ParseColor("#F2C14E");
                canvas.DrawRect(
                    x - halfWidth,
                    y + halfHeight - 10f,
                    x - halfWidth + 2 * halfWidth * station.Progress,
                    y + halfHeight,
                    _fill);

                _text.Color = Color.White;
                _text.TextSize = Width * 0.030f;
                canvas.DrawText(slot.Label, x, y - halfHeight * 0.25f, _text);

                _text.TextSize = Width * 0.026f;
                _text.Color = Color.ParseColor("#B8C0CC");
                canvas.DrawText(
                    "L" + station.Level + "   x" + station.OutputCount,
                    x, y + halfHeight * 0.45f, _text);

                if (station.IsStaffed)
                {
                    _fill.Color = Color.ParseColor("#4FB477");
                    canvas.DrawCircle(x + halfWidth - 14f, y - halfHeight + 14f, 10f, _fill);
                }

                if (station.NeedsRestock)
                {
                    _text.Color = Color.ParseColor("#E5533D");
                    _text.TextSize = Width * 0.026f;
                    canvas.DrawText("EMPTY", x, y - halfHeight - 12f, _text);
                }
            }
        }

        private static string ColourFor(StationState state)
        {
            switch (state)
            {
                case StationState.Producing:
                    return "#3D5A80";
                case StationState.OutputReady:
                    return "#4B7F52";
                case StationState.Blocked:
                    return "#8C5A3C";
                default:
                    return "#333A45";
            }
        }

        private void DrawCounters(Canvas canvas)
        {
            var halfWidth = Width * 0.10f;
            var halfHeight = Height * 0.030f;

            foreach (var slot in _world.Counters)
            {
                var x = slot.Position.X * Width;
                var y = slot.Position.Y * Height;

                _fill.Color = Color.ParseColor("#2E4A6B");
                canvas.DrawRoundRect(
                    new RectF(x - halfWidth, y - halfHeight, x + halfWidth, y + halfHeight),
                    14f, 14f, _fill);

                _text.Color = Color.White;
                _text.TextSize = Width * 0.028f;
                canvas.DrawText(slot.Label, x, y + halfHeight * 0.4f, _text);

                if (slot.Counter.IsStaffed)
                {
                    _fill.Color = Color.ParseColor("#4FB477");
                    canvas.DrawCircle(x + halfWidth - 14f, y - halfHeight + 12f, 10f, _fill);
                }

                DrawQueue(canvas, slot, x, y + halfHeight);
            }
        }

        private void DrawQueue(Canvas canvas, CounterSlot slot, float x, float top)
        {
            var queue = slot.Counter.Queue;
            var step = Height * 0.035f;
            var radius = Width * 0.022f;

            for (var i = 0; i < queue.Count; i++)
            {
                var customer = queue[i];
                var cy = top + step * (i + 0.9f);

                _fill.Color = customer.State == CustomerState.WaitingForFood
                    ? Color.ParseColor("#D8DEE9")
                    : Color.ParseColor("#6C7482");
                canvas.DrawCircle(x, cy, radius, _fill);

                // Patience, as a bar rather than a colour alone: a red bar and a green bar are
                // the same bar to a red-green colourblind player.
                var barWidth = radius * 2.4f;
                var fraction = customer.PatienceFraction;

                _fill.Color = Color.ParseColor("#3A3F4A");
                canvas.DrawRect(x - barWidth / 2, cy + radius + 4, x + barWidth / 2, cy + radius + 12, _fill);

                _fill.Color = fraction > 0.5f
                    ? Color.ParseColor("#4FB477")
                    : fraction > 0.25f ? Color.ParseColor("#E8B84B") : Color.ParseColor("#E5533D");
                canvas.DrawRect(
                    x - barWidth / 2, cy + radius + 4,
                    x - barWidth / 2 + barWidth * fraction, cy + radius + 12, _fill);

                _text.Color = Color.ParseColor("#11141A");
                _text.TextSize = radius * 1.1f;
                canvas.DrawText(customer.ItemsOutstanding.ToString(), x, cy + radius * 0.4f, _text);
            }
        }

        private void DrawPlayer(Canvas canvas)
        {
            var x = _world.Player.X * Width;
            var y = _world.Player.Y * Height;
            var radius = Width * 0.030f;

            _stroke.Color = Color.ParseColor("#33FFFFFF");
            _stroke.StrokeWidth = 3f;
            canvas.DrawCircle(x, y, GameWorld.InteractionRadius * Width, _stroke);

            _fill.Color = _world.HasCrate ? Color.ParseColor("#D9A441") : Color.ParseColor("#F2F4F8");
            canvas.DrawCircle(x, y, radius, _fill);

            // The carry stack, drawn as the boxes it is.
            var boxWidth = radius * 1.5f;
            for (var i = 0; i < _world.Stack.Count && i < 12; i++)
            {
                _fill.Color = Color.ParseColor("#E8B84B");
                var boxTop = y - radius - 8 - (i + 1) * 9;
                canvas.DrawRect(x - boxWidth / 2, boxTop, x + boxWidth / 2, boxTop + 7, _fill);
            }
        }

        private void DrawHud(Canvas canvas)
        {
            _fill.Color = Color.ParseColor("#11141A");
            canvas.DrawRect(0, 0, Width, Height * 0.11f, _fill);

            _text.TextAlign = Paint.Align.Left;
            _text.Color = Color.ParseColor("#F2C14E");
            _text.TextSize = Width * 0.055f;
            canvas.DrawText("$" + NumberFormat.Currency(_world.Economy.Cash), Width * 0.03f, Height * 0.045f, _text);

            _text.Color = Color.ParseColor("#B8C0CC");
            _text.TextSize = Width * 0.030f;
            canvas.DrawText(
                "Lv " + _world.Economy.PlayerLevel
                + "   combo x" + _world.Combo.Multiplier.ToString("0.00")
                + "   carry " + _world.Stack.Count + "/" + _world.Stack.Capacity,
                Width * 0.03f, Height * 0.075f, _text);

            _text.Color = Color.ParseColor("#8A93A0");
            _text.TextSize = Width * 0.027f;
            canvas.DrawText(_world.Hint, Width * 0.03f, Height * 0.100f, _text);
            _text.TextAlign = Paint.Align.Center;

            if (_bannerSeconds > 0 && _world.OfflineReward.HasReward)
            {
                _fill.Color = Color.ParseColor("#CC1F6F4A");
                canvas.DrawRect(0, Height * 0.11f, Width, Height * 0.16f, _fill);
                _text.Color = Color.White;
                _text.TextSize = Width * 0.032f;
                canvas.DrawText(
                    "While you were away: $" + NumberFormat.Currency(_world.OfflineReward.BaseAmount),
                    Width / 2f, Height * 0.142f, _text);
            }
        }

        private void DrawButtons(Canvas canvas)
        {
            for (var i = 0; i < _buttonBounds.Length; i++)
            {
                var button = _world.Buttons[i];
                var bounds = _buttonBounds[i];
                var enabled = button.Enabled();

                _fill.Color = Color.ParseColor(enabled ? "#2E6B4F" : "#242830");
                canvas.DrawRoundRect(bounds, 14f, 14f, _fill);

                _text.Color = Color.ParseColor(enabled ? "#FFFFFF" : "#69707C");
                _text.TextSize = Width * 0.030f;
                canvas.DrawText(button.Label, bounds.CenterX(), bounds.CenterY() - 4, _text);

                _text.TextSize = Width * 0.026f;
                _text.Color = Color.ParseColor(enabled ? "#CFF3DF" : "#565C66");
                canvas.DrawText(button.Caption(), bounds.CenterX(), bounds.CenterY() + Width * 0.032f, _text);
            }
        }

        private void DrawJoystick(Canvas canvas)
        {
            var bandTop = Height * JoystickBandTop;

            _fill.Color = Color.ParseColor("#0E1116");
            canvas.DrawRect(0, bandTop, Width, Height, _fill);

            if (_joystickPointer < 0)
            {
                _text.Color = Color.ParseColor("#4A515C");
                _text.TextSize = Width * 0.032f;
                canvas.DrawText("drag here to move", Width / 2f, (bandTop + Height) / 2f, _text);
                return;
            }

            var radius = Width * 0.115f;

            _stroke.Color = Color.ParseColor("#3A414D");
            _stroke.StrokeWidth = 5f;
            canvas.DrawCircle(_joystickOriginX, _joystickOriginY, radius, _stroke);

            _fill.Color = Color.ParseColor("#E8EDF5");
            canvas.DrawCircle(_joystickKnobX, _joystickKnobY, radius * 0.42f, _fill);
        }

        // ------------------------------------------------------------------------------
        // Input
        // ------------------------------------------------------------------------------

        public override bool OnTouchEvent(MotionEvent e)
        {
            if (e == null)
            {
                return false;
            }

            var index = e.ActionIndex;
            var pointer = e.GetPointerId(index);

            switch (e.ActionMasked)
            {
                case MotionEventActions.Down:
                case MotionEventActions.PointerDown:
                    HandlePress(pointer, e.GetX(index), e.GetY(index));
                    return true;

                case MotionEventActions.Move:
                    // Only the pointer that grabbed the stick steers, so a thumb on a button
                    // never yanks the player across the shop.
                    for (var i = 0; i < e.PointerCount; i++)
                    {
                        if (e.GetPointerId(i) == _joystickPointer)
                        {
                            UpdateJoystick(e.GetX(i), e.GetY(i));
                        }
                    }

                    return true;

                case MotionEventActions.Up:
                case MotionEventActions.PointerUp:
                case MotionEventActions.Cancel:
                    if (pointer == _joystickPointer)
                    {
                        ReleaseJoystick();
                    }

                    return true;
            }

            return base.OnTouchEvent(e);
        }

        private void HandlePress(int pointer, float x, float y)
        {
            if (y >= Height * JoystickBandTop)
            {
                _joystickPointer = pointer;
                _joystickOriginX = x;
                _joystickOriginY = y;
                _joystickKnobX = x;
                _joystickKnobY = y;
                return;
            }

            for (var i = 0; i < _buttonBounds.Length; i++)
            {
                if (!_buttonBounds[i].Contains(x, y))
                {
                    continue;
                }

                var button = _world.Buttons[i];
                if (button.Enabled())
                {
                    button.Press();
                }

                return;
            }
        }

        private void UpdateJoystick(float x, float y)
        {
            var radius = Width * 0.115f;
            var dx = x - _joystickOriginX;
            var dy = y - _joystickOriginY;
            var distance = (float)Math.Sqrt(dx * dx + dy * dy);

            if (distance > radius)
            {
                dx = dx / distance * radius;
                dy = dy / distance * radius;
            }

            _joystickKnobX = _joystickOriginX + dx;
            _joystickKnobY = _joystickOriginY + dy;

            // Deflection maps to speed, so a stick pushed halfway walks at half pace. This is
            // the difference between fine positioning at a counter and constant overshooting.
            _moveX = dx / radius;
            _moveY = dy / radius;
        }

        private void ReleaseJoystick()
        {
            _joystickPointer = -1;
            _moveX = 0f;
            _moveY = 0f;
        }
    }
}
