"""Disconnect a real terminal at an observable construction boundary."""
import os
import pty
import selectors
import subprocess
import sys

master, slave = pty.openpty()
control_read, control_write = os.pipe()
child = None
try:
    child = subprocess.Popen(
        [sys.argv[1], sys.argv[2], str(control_read)],
        stdin=slave,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        pass_fds=(control_read,),
    )
    os.close(slave)
    slave = -1
    os.close(control_read)
    control_read = -1
    with selectors.DefaultSelector() as selector:
        selector.register(child.stdout, selectors.EVENT_READ)
        if not selector.select(3):
            raise RuntimeError("TTY child did not reach readiness")
        if child.stdout.readline() != b"READY\n":
            raise RuntimeError("Unexpected TTY readiness output")
    os.close(master)
    master = -1
    os.write(control_write, b"x")
    os.close(control_write)
    control_write = -1
    stdout, stderr = child.communicate(timeout=3)
    sys.stdout.buffer.write(stdout)
    sys.stderr.buffer.write(stderr)
    sys.exit(child.returncode)
finally:
    if child is not None and child.poll() is None:
        child.kill()
        child.communicate()
    for descriptor in [master, slave, control_read, control_write]:
        if descriptor >= 0:
            os.close(descriptor)
