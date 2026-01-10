import sys
import os

print(f"Current CWD: {os.getcwd()}")
# Ensure current dir is in path
if os.getcwd() not in sys.path:
    sys.path.append(os.getcwd())

try:
    import performance_scorecard
    print(f"Successfully imported performance_scorecard from {performance_scorecard.__file__}")
except Exception as e:
    print(f"Failed to import performance_scorecard: {e}")

try:
    import performance_scorecard.performance_scorecard
    print(f"Successfully imported performance_scorecard.performance_scorecard from {performance_scorecard.performance_scorecard.__file__}")
except Exception as e:
    print(f"Failed to import performance_scorecard.performance_scorecard: {e}")
