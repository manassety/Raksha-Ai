import os
import shutil

unwanted_files = [
    "emergency_fix.js", "extract_git.js", "find_ip.js", "fix_bracket.js",
    "fix_final.js", "fix_sos_syntax.js", "fix_syntax.js", "resolve_all_alerts.mjs",
    "test_ip.js", "test_ip2.js", "build_app.bat", "debug_build.bat",
    "install_deps.bat", "setup.ps1", "solve_deps.bat", "start_server.bat",
    "unzip.bat", "python_backend.zip", "server.zip", "app.py",
    "MobileNetSSD_deploy.caffemodel", "MobileNetSSD_deploy.prototxt",
    "coco.names", "yolov3-tiny.cfg", "requirements.txt",
    "navigation.navigate(SCREEN_NAMES.CRIME_ANALYSIS)}",
    "navigation.navigate(SCREEN_NAMES.NEARBY_ALERTS)}",
    "navigation.navigate(action.screen)}",
    "navigation.navigate(feature.screen)}",
    "setRefreshing(false)"
]

unwanted_dirs = ["backEnd file", "src_temp", "tmp"]

base_path = "c:\\RakshaAi"

for f in unwanted_files:
    p = os.path.join(base_path, f)
    if os.path.exists(p):
        try: os.remove(p)
        except Exception as e: print("Fail rm", p, e)

for d in unwanted_dirs:
    p = os.path.join(base_path, d)
    if os.path.exists(p):
        try: shutil.rmtree(p)
        except Exception as e: print("Fail rd", p, e)

print("done cleaning")
