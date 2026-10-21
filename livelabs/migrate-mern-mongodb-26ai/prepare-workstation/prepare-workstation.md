# Prepare Your Workstation

## Introduction

Every later lab runs on your own machine, so a missing or outdated tool would stop you halfway through the migration. In this lab you install the tools once, clone the workshop repository and check every version. Choose the **Linux** tab or the **Windows** tab for your operating system. The Linux tab also applies to macOS; on macOS use Homebrew (`brew install ...`) in place of the package manager commands.

Estimated Time: 30 minutes

### Objectives

In this lab, you will:

* Install Git, Node.js, Python, a container engine, MongoDB Database Tools, mongosh, Java and SQLcl
* Clone the workshop repository
* Verify that every tool meets the minimum version

### Prerequisites

This lab assumes you have:

* Administrator (or sudo) rights on your workstation
* Internet access

## Task 1: Install the tools

Install the tools the workshop uses. Git fetches the repository, Node.js runs the storefront, Docker or Podman runs the source MongoDB, the MongoDB Database Tools (`mongodump`, `mongorestore`) move the data, `mongosh` is the MongoDB shell, Python runs the validation script, and SQLcl is Oracle's command-line SQL client (it needs Java). Minimum versions: Node.js 22.12+ (or 20.19+), Python 3.10+, Java 17+ and SQLcl 25.2+.

<if type="linux">

1. Install Git, Python, Java and Docker (Debian/Ubuntu shown; use `dnf` on Oracle Linux/Fedora).

    ```
    <copy>
    sudo apt-get update
    sudo apt-get install -y git curl unzip python3 python3-venv openjdk-17-jre-headless docker.io
    sudo usermod -aG docker "$USER"
    </copy>
    ```

    Log out and back in so the `docker` group applies. To use Podman instead, run `sudo apt-get install -y podman`.

2. Install Node.js 22 LTS.

    ```
    <copy>
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
    </copy>
    ```

3. Install the MongoDB Database Tools (`mongodump`, `mongorestore`) and `mongosh` from MongoDB's official apt repository (Ubuntu shown; the repository also publishes Debian packages).

    ```
    <copy>
    curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg
    . /etc/os-release
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${VERSION_CODENAME}/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
    sudo apt-get update
    sudo apt-get install -y mongodb-mongosh mongodb-database-tools
    </copy>
    ```

    On Oracle Linux or Fedora, download the `.rpm` packages from the [Database Tools](https://www.mongodb.com/try/download/database-tools) and [mongosh](https://www.mongodb.com/try/download/shell) download pages. On macOS, run `brew tap mongodb/brew && brew install mongodb-database-tools mongosh`.

4. Install SQLcl. Download the latest zip from the [SQLcl page](https://www.oracle.com/database/sqldeveloper/technologies/sqlcl/download/), then unpack it and add it to your path.

    ```
    <copy>
    sudo unzip -o ~/Downloads/sqlcl-latest.zip -d /opt
    echo 'export PATH="$PATH:/opt/sqlcl/bin"' >> ~/.bashrc
    source ~/.bashrc
    </copy>
    ```

</if>
<if type="windows">

1. Open **PowerShell** as Administrator and install the tools with winget.

    ```
    <copy>
    winget install --id Git.Git -e
    winget install --id OpenJS.NodeJS.LTS -e
    winget install --id Python.Python.3.12 -e
    winget install --id Docker.DockerDesktop -e
    winget install --id MongoDB.DatabaseTools -e
    winget install --id MongoDB.Shell -e
    winget install --id Microsoft.OpenJDK.17 -e
    </copy>
    ```

2. Start Docker Desktop once and accept its terms, then close and reopen PowerShell so the new tools are on your `PATH`.

3. Install SQLcl. Download the latest zip from the [SQLcl page](https://www.oracle.com/database/sqldeveloper/technologies/sqlcl/download/), then unpack it and add it to your user path.

    ```
    <copy>
    Expand-Archive -Path "$HOME\Downloads\sqlcl-latest.zip" -DestinationPath "$HOME\tools" -Force
    [Environment]::SetEnvironmentVariable("Path", "$([Environment]::GetEnvironmentVariable('Path','User'));$HOME\tools\sqlcl\bin", "User")
    </copy>
    ```

    Open a new PowerShell window afterwards.

</if>

## Task 2: Clone the repository

Download the workshop scripts, SQL files and sample app. Every later lab runs its commands from this directory (the repository root).

1. Clone the repository and change into it.

    <if type="linux">

    ```
    <copy>
    git clone https://github.com/jasperan/mongodb-migrate-oci.git
    cd mongodb-migrate-oci
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    git clone https://github.com/jasperan/mongodb-migrate-oci.git
    cd mongodb-migrate-oci
    Set-ExecutionPolicy -Scope Process Bypass
    </copy>
    ```

    `Set-ExecutionPolicy -Scope Process Bypass` allows the `scripts\workshop\*.ps1` scripts to run in this window. Repeat it in every new PowerShell window you open for the workshop.

    </if>

## Task 3: Verify the installation

Confirm that every tool is on your path and recent enough.

1. Print the version of each tool.

    <if type="linux">

    ```
    <copy>
    git --version; node --version; npm --version; python3 --version
    (docker --version || podman --version); mongodump --version | head -1
    mongorestore --version | head -1; mongosh --version; java -version 2>&1 | head -1
    sql -V
    </copy>
    ```

    </if>
    <if type="windows">

    ```
    <copy>
    git --version; node --version; npm --version; python --version
    docker --version; mongodump --version | Select-Object -First 1
    mongorestore --version | Select-Object -First 1; mongosh --version
    java -version 2>&1 | Select-Object -First 1
    sql -V
    </copy>
    ```

    </if>

    You should see a version line for each tool, and no `command not found` or `not recognized` errors.

2. Check the versions: Node.js 22.12 or later (or 20.19 or later), Python 3.10 or later, Java 17 or later and SQLcl 25.2 or later. Fix any tool that is missing or too old before you continue.

You may now **proceed to the next lab**.

## Learn More

* [Node.js downloads](https://nodejs.org/en/download)
* [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/)
* [Oracle SQLcl](https://www.oracle.com/database/sqldeveloper/technologies/sqlcl/)

## Acknowledgements

* **Author** - Ignacio Martinez, Oracle
* **Last Updated By/Date** - Ignacio Martinez, October 2026
