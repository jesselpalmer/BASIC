# Play Pong

Pong is a complete one-player game written in [pong.bas](../examples/pong.bas).
The browser supplies drawing, timing and keyboard input; the BASIC program owns
movement, the computer opponent, collisions, scoring and match state.

From a checkout:

```sh
bun install --frozen-lockfile
bun run build:playground
bun run serve:playground
```

Open `http://127.0.0.1:3000`, choose **Pong**, and select **Run program**.
Press Enter in the start prompt. Then click the graphics canvas or reach it
with Tab. Hold **Up/Down** to move the green paddle on the left; press **Space**
to serve. The computer controls the red paddle on the right. Escape or Stop
ends the run at any time.

The ball waits at the center before each serve, giving you time to focus the
canvas and position your paddle. Space starts that rally. The first player to
score **3** wins. A miss gives the other player one point. Hit the ball away
from the center of your paddle to change its angle and make the computer work.
The computer moves more slowly and follows only an approaching ball in its
half, so both winning and losing are possible.

The result and final score appear in the console. Press Enter in the restart
prompt to begin a fresh match, then focus the canvas and press Space again.
Restart resets scores, paddle positions, the ball and serve state. Entering
that prompt also clears queued and held keyboard input. Each frame completes
before its WAIT; only one frame timer is pending.

Leaving the canvas or hiding the tab releases held keys. Return focus and press
the controls again to move. The simulation continues while focus is elsewhere;
use **Pause** to suspend it at the next statement boundary. **Continue** retains
the game state. Stop followed by Run starts a new program with a fresh start
prompt. Editing source during play applies only to the next Run.

Use **Export .bas** to download the editable game. **Import .bas** can load that
same source back into the playground; it runs through the same interpreter.
The game needs graphics and keyboard host capabilities. The Bun terminal does
not supply them and reports an unsupported-host diagnostic; library users can
supply their own drawing and keyboard adapters.

## Program structure and checks

The source groups initialization, serving, complete-frame rendering, player and
computer movement, wall/paddle contacts, scoring and match completion with REM
comments. It uses existing statements and expressions, without arrays,
subroutines, a JavaScript game engine, or special Pong commands. WAIT timing is
approximate, as described in the [animation contract](wait.md).

Deterministic tests execute the actual game source with controlled input,
randomness and frame completion. Browser tests play through the public controls
and inspect the same displayed state, including wins/losses, restart, focus,
Stop/rerun and source round trips. Packed-library checks load the shipped game,
render its first frame, cancel it and run it again. See [quality checks](quality-checks.md)
for the full validation commands.
