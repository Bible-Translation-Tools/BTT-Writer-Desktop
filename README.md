[![Build Status](https://travis-ci.com/WycliffeAssociates/ts-desktop.svg?branch=develop)](https://travis-ci.com/WycliffeAssociates/ts-desktop)

BTT-Writer Desktop
--

A tool to translate the Bible into your own language.

# Installation
The [Releases](https://github.com/Bible-Translation-Tools/BTT-Writer-Desktop/releases) have installers for 32-bit and 64-bit **Windows** installations. `git` is bundled with these installers (and is a specific version known to work).

**Linux** users should unzip the release file and install it as **BTT-Writer** in the `/opt/` directory. The included `BTT-Writer.desktop` file should be copied to the `/usr/share/applications/` directory to be picked up by the OS.

**macOS** users can unzip the application and put it where they want it (usually the `/Applications/` directory).

Both **Linux** and **Mac** users will need to install `git` to run the program. Linux users can probably do this with `sudo apt install git`, while Intel Mac users are encouraged to use the version of `git-scm` available [here](https://sourceforge.net/projects/git-osx-installer/files/git-2.33.0-intel-universal-mavericks.dmg/download).

**Git versions < 2.28 are not supported.**

The program is not signed for either **macOS** or **Windows**, so users will need to deal with the warnings, etc., involved with that.

More information and assistance can be found at https://techadvancement.com

# Development / Contributing

## Quick Start
First make sure you have [NodeJS](https://nodejs.org/) installed (choose the Current, not LTS). Then, in your terminal/command line window:

	$ npm install -g bower
	$ npm install -g gulp

Then fork this repository and clone your fork.
After the repository has been cloned to your computer run the following command in the new directory to set up your environment

    $ npm install && bower install

		Alternatively, a Docker build pipeline and makefile are provided to make building and running easier.

### Commands
The following commands are available from within the project directory:

* `$ gulp build --win` builds a windows distribution (other available flags are `--osx` and `--linux`)
* `$ gulp test` runs all Mocha unit tests
* `$ gulp test --grep [string]` runs the Mocha unit tests that match the string
* `$ gulp` runs the `test` task
* `$ npm start` runs the application (without building it)

> Note: You can open the Chrome Developer Tools while the app is running by pressing `Ctrl+Shift+I` on Windows/Linux or `Cmd-Shift-I` on macOS.
