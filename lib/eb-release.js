//DEPENDENCIES - from a galaxy far far away
var yargs = require('yargs'),
    EBHandler = require('./handlers/eb'),
    PackageHandler = require('./handlers/package'),
    GitHandler = require('./handlers/git'),
    ConfigHandler = require('./handlers/config'),
    taskRunner = require('./helpers/taskRunner'),
    readline = require('readline'),
    perf = require('./helpers/performance'),
    mess = require('./helpers/messenger');

//RECORD STATUS OF GIT STASH
var DID_STASH_CHANGES = false;
var DEPLOY_ONLY = false;

//STORE ORIGINAL CWD - Helps to know where you're at sometimes
const CWD = process.cwd();

//SETUP HANDLERS - They help simply the difficult stuff
var git = new GitHandler();
var eb = new EBHandler();
var package = new PackageHandler(CWD);
var config = new ConfigHandler(CWD);

//HANDLE INPUT AND OUTPUT STREAMS - allows for asking the tough questiong and processing negative responses (i.e. CTRL-C)
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})
rl.on('close', () => {
    endProcess();
})

var COMMAND_LIST = ['deploy', 'simulate'];

//DECLARE CLI ARGUMENT HANDLER - yaaaaaarg matey!
var argv = yargs
    .usage('Usage: $0 <command> [options]')
    .command('deploy', 'deploy application to elastic beanstalk environment', () => {}, (args) => deploy(args, true)) //FIRES DEPLOY FUNCTION WHEN DEPLOY COMMAND IS GIVEN
    .command('simulate', 'will attempt to complete all tasks and processes without deploying to EB', () => {}, (args) => deploy(args, false))
    .demandCommand()
    .example('$0 deploy my_application')
    .option('file', {
        alias: 'f',
        describe: 'provide a path to a specific config file'
    })
    .option('verbose', {
        alias: 'b',
        describe: 'display all intermediate status messages'
    })
    .option('performance', {
        alias: 'p',
        describe: 'display task completion times'
    })
    .option('deploy-only', {
        alias: 'd',
        describe: 'skips all changes and runs deployment directly'
    })
    .boolean('verbose')
    .boolean('performance')
    .boolean('deploy-only')
    .help('help')
    .alias('help', 'h')
    .version()
    .alias('version', 'v')
    .epilog('Copyright ' + mess.chars.copy + " " + (new Date()).getFullYear() + ", Philip Brown")
    .argv;

function deploy(args, sendToEB){
    //Tack start time
    perf.start("EB Release");
    //Check dependencies, set cli options, and get username
    setupEnv(args, (username) => {
        mess.welcome(username);
        //Choose Elastic Beanstalk environment
        chooseEnvironment(args._, (envName) => {
            if(!DEPLOY_ONLY){
                //Attempt to load task list from config (On failure, user decides to "deployApplication" or "endProcess")
                loadTasks(envName, args, sendToEB, (tasks) => {
                    //Checks for a clean working environment (On failure, user decides to stash changes and continue or "endProcess")
                    checkForUntrackedChanges(() => {
                        //Runs through task list
                        runTasks(tasks, envName, 1, () => {
                            //Modify package.json file
                            packageModifications(() => {
                                //Create release branch
                                createRelease(envName, (startingBranch) => {
                                    //Deploy application to Elastic Beanstalk Environment
                                    deployApplication(envName, sendToEB, (ebSuccess) => {
                                        //Restore user to original git branch
                                        restoreEnvironment(startingBranch, () => {
                                            //We're done!! Yay
                                            return endProcess(!ebSuccess);
                                        })
                                    })
                                })
                            })
                        })
                    })
                })
            }else{
                deployApplication(envName, sendToEB, (ebSuccess) => {
                    //Finish here
                    return endProcess(!ebSuccess);
                })
            }
        })
    })
}

//Performs dependency validations and setting initial cli options (Will stop process if dependency validation fails)
function setupEnv(args, cb){
    git.validate((hasGit) => {
        eb.validate((hasEB) => {
            if(!hasGit || !hasEB){
                if(!hasGit) 
                    mess.error("MISSING GLOBAL DEPENDENCY \"git\" - Please visit \"https://git-scm.com/downloads\" to download");
                if(!hasEB)
                    mess.error("MISSING GLOBAL DEPENDENCY \"eb\" - Please visit \"https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3-install.html\" for installation instructions");
                return endProcess(true);
            }else{
                //Set console flag options
                if(args.verbose) mess.setVerbose(true);
                if(args.performance) mess.setPerformance(true);
                if(args['deploy-only']) DEPLOY_ONLY = true;
                git.getUsername((username) => {
                    return cb(username);
                })
            }
        })
    })
}

//Method to pick Elastic Beanstalk Environment
function chooseEnvironment(userPicked, cb){
    //Grab env name from arguments first
    var cliEnv = userPicked;
    if(cliEnv.length){
        cliEnv = cliEnv[cliEnv.length -1].trim();
        if(COMMAND_LIST.indexOf(cliEnv.toLowerCase()) !== -1) cliEnv = null;
    }else cliEnv = null;
    if(cliEnv){
        mess.load("Validating EB Environment");
        perf.start("Validating EB Environment")
    }else{
        mess.load("Retrieving EB Environments");
        perf.start("Retrieving EB Environments");
    }
    eb.list((ebEnvs) => {
        mess.stopLoad(true);
        if(cliEnv) perf.end("Validating EB Environment");
        else perf.end("Retrieving EB Environments");
        if(!ebEnvs || !ebEnvs.environments.length){
            mess.error("An Elastic Beanstalk environment has not been established yet. Please check you current directory or run \"$ eb init\" to setup your environment");
            endProcess(true);
        }else if(cliEnv && ebEnvs.environments.indexOf(cliEnv) !== -1){
            mess.success("Valid Environment");
            return cb(cliEnv);
        }else{
            mess.ebEnvs(ebEnvs);
            mess.envQuestion(ebEnvs, rl, (envName) => {
                return cb(envName);
            })
        }
    })
}

//Loads a configuration file in the CWD and pulls any tasks from the file.  If no config file or tasks were found, asks user if they still wish to deploy
function loadTasks(env, args, shouldDeploy, cb){
    var didLoad = config.load(args.file);
    var tasks = config.getTasks();
    if(!tasks) mess.warning("No tasks were found/specified");
    if(!didLoad || !tasks){
        mess.yesOrNo('Would you like to deploy anyways?', rl, (yes) => {
            if(yes){
                return deployApplication(env, shouldDeploy);
            }else{
                endProcess();
            }
        })
    }else{
        return cb(tasks);
    }
}

//Checks git for local untracked changes and allows the user to authorize stashing those changes for later and continuing
function checkForUntrackedChanges(cb){
    git.changes((changes) => {
        if(changes){
            if(changes.untracked){
                mess.warning("You have uncommitted changes. They will be stashed and returned to you after deployment");
                mess.yesOrNo("Stash changes and continue?", rl, (yes) => {
                    if(yes){
                        git.add(() => { //Add changes first
                            git.stash((stashed) => {
                                DID_STASH_CHANGES = stashed;
                                return cb();
                            })
                        })
                    }else{
                        return endProcess();
                    }
                })
            }else{
                return cb();
            }
        }else{
            mess.error("Unable to retrieve git changes. Please check your environment");
            endProcess(true);
        }
    })
}

//Takes an array of task configurations and runs each one in order
function runTasks(tasks, envName, index, cb){
    if(tasks.length === 0) return cb();
    var thisTask = (tasks.splice(0, 1))[0];
    taskRunner(thisTask, {envName: envName, handler: eb}, index, (success) => {
        if(success){
            return runTasks(tasks, envName, index+1, cb);
        }else{
            var message = (tasks.length === 0)? "Continue deploying?" : "Continue executing remaining tasks?";
            mess.yesOrNo(message, rl, (yes) => {
                if(yes){
                    return runTasks(tasks, envName, index+1, cb);
                }else{
                    endProcess();
                }
            })
        }
    });
}

//Loads package.json changes from the config file and applies them if necessary
function packageModifications(cb){
    var packageConfig = config.packageChanges();
    if(packageConfig){
        mess.load("Modifying package.json file");
        perf.start("Package.json changes");
        package.modify(packageConfig, (success) => {
            mess.stopLoad(true);
            perf.end("Package.json changes");
            if(!success){
                mess.yesOrNo("Continue deploying?",rl,(yes) => {
                    if(yes){
                        return cb();
                    }else{
                        return endProcess();
                    }
                })
            }else{
                mess.success("Finished modifying package.json");
                return cb();
            }
        })
    }else{
        return cb();
    }
}

//Creates a git release branch
function createRelease(envName, cb){
    mess.load("Creating/Updating release branch");
    perf.start("Creating/Updating release branch");
    git.getCurrentBranch((startingBranch) => {
        var releaseBranch = config.releaseName();
        if(startingBranch === releaseBranch) startingBranch = 'master';
        git.changes((changes) => {
            var ignored = config.ignoredFiles();
            if(changes && changes.ignored && ignored){
                ignored = ignored.filter((item) => {
                    if(changes.ignored.indexOf(item) !== -1) return true;
                    return false;
                })
            }else{
                ignored = null
            }
            git.hasBranch(releaseBranch, (hasBranch) => {
                addChangesToReleaseBranch(hasBranch, releaseBranch, ignored, () => {
                    mess.status("Committing all changes");
                    git.commit(envName, () => {
                        if(!hasBranch) mess.status("Publishing release branch");
                        else mess.status("Pushing release branch to remote");
                        git.push(releaseBranch, () => {
                            mess.stopLoad(true);
                            perf.end("Creating/Updating release branch");
                            mess.success("Finished creating/updating release branch");
                            return cb(startingBranch);
                        })
                    })
                })
            })
        })
    })
}

function addChangesToReleaseBranch(hasBranch, releaseBranch, ignored, cb){
    if(!hasBranch){ //Not having the branch locally is much simpler (Only 2 steps)
        mess.status("Adding changes to NEW release branch");
        //Step 1: create new branch and move to it
        git.checkout(releaseBranch, () => {
            //Step 2: Add all changes to the release branch (including any ignored changes)
            git.add(null, ignored, () => {
                mess.status("Changes added to NEW release branch");
                return cb();
            })
        })
    }else{ //Having an existing release branch is harder, borderline hacky (4 steps)
        mess.status("Adding changes to EXISTING release branch");
        //Step 1: Add all changes to the current branch (including any ignored changes)
        git.add(null, ignored, () => {
            //Step 2: Create a new stash record with the added changes
            git.stash(() => {
                //Step 3: Move over to the release branch
                git.checkout(releaseBranch, () => {
                    //Step 4: Merge stashed changes into the release branch (resolves all conflicts in favor of the stashed changes)(emulates "git stash pop" in functionality)
                    git.mergeStash(() => {
                        mess.status("Changes added to EXISTING release branch");
                        //No need to add changes since this has already been done
                        return cb();
                    })
                })
            })
        })
    }
}

//Deploys application to Elastic Beanstalk
function deployApplication(envName, shouldDeploy, cb){
    if(shouldDeploy){
        mess.warning("EB deployment can take time - will timeout after 30 minutes if incomplete");
        mess.load("Deploying release branch to EB Environment: " + envName);
        perf.start("EB Deploy");
        eb.deploy(envName, (success) => {
            mess.stopLoad(true);
            perf.end("EB Deploy");
            if(success){
                mess.success("Finished deploying to elastic beanstalk!!");
                return cb(true);
            }else{
                mess.error("Failed to deploy to elastic beanstalk --OR-- timed out");
                return cb(false);
            }
        })
    }else{
        mess.load("Simulating EB deployment process - 2 secs")
        setTimeout(() => {
            mess.stopLoad(true);
            mess.success("Successfully simulated eb deployment");
            return cb(true);
        }, 2000);
    }
}

//Restores Git environment to original branch
function restoreEnvironment(startingBranch, cb){
    mess.status("Returning to original branch");
    git.checkout(startingBranch, () => {
        mess.success("Returned to original branch");
        return cb();
    });
}

//Method to track full script time, print goodbye message, and end execution
function endProcess(errors){
    if(DID_STASH_CHANGES){
        mess.status("Popping stashed git changes");
        git.pop(() => {
            mess.success("Restored stashed local changes");
            perf.end("EB Release");
            mess.endProcess(errors);
            process.exit();
        });
    }else{
        perf.end("EB Release"); //Track end time of full script
        mess.endProcess(errors);
        process.exit();
    }
}