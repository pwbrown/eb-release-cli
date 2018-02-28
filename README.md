# eb-release-cli --> "ebr"

## Description:
eb release is a CLI tool to help perform a series of "user configured" tasks prior to deploying an application to an AWS "elastic beanstalk" environment.  The changes made by the tasks are saved to a seperate "git" branch in order to prevent pollution of the user's branch.

## Prerequisites
#### ***NOTE:*** This package does not interface directly with AWS or GIT, but rather indirectly runs commands through the usage of pre-installed and pre-configured "eb" and "git" installations.
* ***AWS EB CLI*** - Please ensure that the eb cli is installed and accessible on your machine, and that the repository of choice is already pre-configured (Hint: $ eb init) - [Docs](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3.html)
* ***Git Source Control*** - Please ensure that the repository you are working in is configured with "Git" in some manner (ex. GitHub, GitLab, BitBucket, etc.)

## Note on Task Commands
-Tasks, configured by the user, expose commands that are run directly by the CLI script via forked/spawned child processes. It is up to YOU to ensure that these commands are cross-system (Unix,Windows, etc.) compatible if you require them to be.  Try to stick to packages that behave and execute the same across different systems (ex. "bash commands"=bad, "npm commands"=good)

## INSTALLATION - globally installed npm cli tool
```
npm install -g ebr
```

## Configuring your application
* Create a file in your root directly called "ebr.config.js"
* Expose a simple JavaScript object with your configuration settings
* The file is split into three configuration settings: "release", "tasks", and "package"

### "release" - Object
* **"name"** : The name to give your release branch in git (String -> optional -> default = "eb-deploy-release" )
* **"includeIgnored"** : A list of git changes to include in the release branch commit that are normally ignored by ".gitignore" (Array -> optional -> default = undefined)

### "tasks" - Array (the following are options for each array task)
* **"command"** : The command to run directly by the system (*String* -> **REQUIRED**)
* **"name"** : A helper name to display while running the task (*String* -> optional -> default = "Task #***task_order_number***")
* **"description"** : A helper description to display while running the task (*String* -> optional -> default = "")
* **"injectEBEnv" - BOOLEAN** : Allows the user to inject the environment variables used by the chosen Elastic beanstalk environment into their command (*Boolean* -> optional -> default = false)
* **"injectEBEnv" - STRING** : Allows the user to inject the environment variables used by the environment defined in this option to their command. This is useful if you want all environments in your application to behave the same. (*String* -> optional -> default = false)
* **"appendEnvName"** : Will append the name of the environment you provided/chose to the end of the command with the format "--eb-env ***env_name_here***" (*Boolean* -> optional -> default = false)

### "package" - Object
* **"moveToDev"** : A list of npm package names to move from normal dependencies to dev dependencies. Note: ***AWS Elastic beansltalk does not install dev dependencies during deployment*** (*Array* -> optional -> default = undefined)
* **"moveFromDev"** : The exact opposite of "moveToDev"
* **"scripts"** : A series of key value pairs in which the key represents the name of an npm script to overwrite, and the value is the new value for the script. Providing the boolean value false will remove the script entirely (*Object* -> optional -> default = undefined)

## Example Configuration file - 'ebr.config.js'
```Javascript
module.exports = {
    "release": {
        "name": "myapp-release",
        "includeIgnored": ['dist/'] //Assuming that "dist/" is ignored by git via the .gitignore file
    },
    "tasks": [
        //Basic Example
        {
            "name": "Webpack",
            "description": "Compiling ES6 JavaScript for browser use",
            "command": "webpack --display errors-only"
        },
        //Command Only
        {
            "command": "babel myApp -q -d dist", //Creates dist/ folder
        },
        //Injecting environment variables
        {
            "command": "gulp",
            "injectEBEnv": true //defaults to whichever eb env is picked when running the cli tool
        },
        //Injecting environment variables from a specific eb environment
        {
            "description": "script that uses production environment in all cases",
            "command": "node myScript.js",
            "injectEBEnv": "my-production-environment-name"
        },
        //Appending the environment name
        {
            "name": "Environment config",
            "description": "Makes file changes depending on which environment it is deploying to",
            "command": "node myEnvScript.js",
            "appendEnvName": true   //Command will now be "node myEnvScript.js --eb-env env_name_here"
        }
    ],
    "package": {  //NEW LOCK FILE IS ALWAYS GENERATED IF CHANGES ARE MADE
        "moveToDev": [ //These packages will be moved to devDependencies
            "babel-cli",
            "babel-loader",
            "webpack",
            "gulp"
        ],
        "scripts":{
            "start": "node index.js",  //Modifies start script
            "prestart": false  //Removes prestart script
        }
    }
}
```

## CLI COMMANDS
### "deploy"
* Usage: "ebr deploy \<application_name\> [options]
* Example: "ebr deploy my_app --verbose"
* Description: Runs through tasks, creates a release branch, and deploys to the chosed eb environment

### "simulate"
* Usage: "ebr simulate \<application_name\> [options]
* Example: "ebr simulate -p"
* Description: Behaves the same as deploy except that it skips the eb deployment step

## CLI Options
### "version"
* Usage: "ebr -v" --OR-- "ebr --version"
* Description: displays the current verson of ebr

### "help"
* Usage: "ebr" --OR-- "ebr -h" --OR-- "ebr --help"
* Description: instructions on ebr usage

### "file"
* Usage: "ebr deploy --file ~/myconfigfile.js" --OR-- "ebr deploy -f ~/myconfigfile.js"
* Description: Provide a path to a custom config file (be default it will look for a file named "ebr.config.js" in the root directory of the application)

### "verbose"
* Usage: "ebr deploy --verbose" --OR-- "ebr deploy -b"
* Description: Display all intermediate status messages

### "performance"
* Usage: "ebr deploy --performance" --OR-- "ebr deploy -p"
* Description: Will show execution time of the script and times of its individual execution steps

### "deploy-only"
* Usage: "ebr deploy --deploy-only" --OR-- "ebr deploy -d"
* Description: Will skip all tasks and simply deploy the application to elastic beanstalk (This option is useful when combined with --performance to help compare deployment time differences) (Try this: "eb simulate -dp" it pretty much does nothing)