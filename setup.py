from pathlib import Path

from setuptools import find_packages, setup


def read_version():
	version_file = Path(__file__).parent / "performance_scorecard" / "__init__.py"
	for line in version_file.read_text(encoding="utf-8").splitlines():
		if line.startswith("__version__"):
			return line.split("=", 1)[1].strip().strip("'\"")
	return "0.0.0"


setup(
	name="performance_scorecard",
	version=read_version(),
	description="Performance Management App for ERPNext",
	packages=find_packages(),
	include_package_data=True,
)
