"""
Setup configuration for Rune CLI package.

Installation:
    pip install -e .           # Development install
    pip install -e ".[dev]"    # With development dependencies
    pip install .              # Production install
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read the README file
readme_file = Path(__file__).parent / "README.md"
long_description = readme_file.read_text(encoding="utf-8") if readme_file.exists() else ""

# Read requirements
requirements_file = Path(__file__).parent / "requirements.txt"
requirements = []
if requirements_file.exists():
    requirements = [
        line.strip()
        for line in requirements_file.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]

setup(
    name="rune-cli",
    version="2.0.0",
    description="Rune Workflow Automation Platform - Professional CLI",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="Rune Team",
    author_email="runeteam1011@gmail.com",
    url="https://github.com/rune-org/rune",
    license="MIT",
    packages=["cli", "cli.auth", "cli.client", "cli.commands", "cli.core", "cli.styles", "cli.utils"],
    package_dir={"cli": "."},
    include_package_data=True,
    python_requires=">=3.10",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=23.0.0",
            "ruff>=0.1.0",
            "mypy>=1.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "rune=cli.main:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Environment :: Console",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Build Tools",
        "Topic :: Utilities",
    ],
    keywords="cli workflow automation rune",
    project_urls={
        "Bug Tracker": "https://github.com/rune-org/rune/issues",
        "Documentation": "https://docs.rune.io",
        "Source": "https://github.com/rune-org/rune",
    },
)
