"""The simulation package must not depend on the web layer."""

import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]


def test_simulation_imports_no_web_framework():
    code = (
        "import sys, radarsync_sim.clock, radarsync_sim.scenarios, radarsync_sim.stability;"
        "bad = sorted(m for m in sys.modules if m.split('.')[0] in {'fastapi', 'starlette', 'pydantic', 'app'});"
        "assert not bad, bad"
    )
    subprocess.run([sys.executable, "-c", code], cwd=BACKEND, check=True)
