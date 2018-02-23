//DEPENDENCIES - from a galaxy far far away
var yargs = require('yargs'),
    EBHandler = require('./handlers/eb'),
    PackageHandler = require('./handlers/package'),
    GitHandler = require('./handlers/git'),
    ConfigHandler = require('./handlers/config'),
    taskRunner = require('./handlers/task'),
    clc = require('cli-color'),
    readline = require('readline'),
    mess = require('./messenger');

//RECORD STATUS OF GIT STASH
var DID_STASH_CHANGES = false;

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
    .help('help')
    .alias('help', 'h')
    .version()
    .alias('version', 'v')
    .epilog('Copyright ' + mess.char.copy + " " + (new Date()).getFullYear() + ", Philip Brown")
    .argv;

function deploy(args, sendToEB){
    //WELCOME THE USER - It's the polite thing to do
    mess.welcome(git.getUsername());
    //VERIFY DEPENDENCIES
    verifyDependencies();
    //DETERMINE EB APPLICATION NAME - Provided through cli option or by direct user input
    chooseEBEnvironment(args._, (envName) => {
        var didLoadConfig = config.load(args.file);
        var tasks = config.getTasks();
        if(!tasks) mess.warning("No tasks were found/specified");
        if(!didLoadConfig || !tasks){
            mess.yesOrNo('Would you like to continue deploying anyways?', rl, (yes) => {
                if(yes){
                    return postTaskCompletion(envName, sendToEB);
                }else{
                    endProcess();
                }
            })
        }else{
            var changes = git.changes();
            if(changes.untracked){
                mess.warning("Looks like you have some uncommited changes. They will be stashed and returned to you after deployment");
                mess.yesOrNo("Stash changes and continue?", rl, (yes) => {
                    if(yes){
                        DID_STASH_CHANGES = git.stash();
                        runTasks(tasks, 1, () => {
                            return postTaskCompletion(envName, sendToEB);
                        })
                    }else{
                        endProcess();
                    }
                })
            }else{
                runTasks(tasks, 1, () => {
                    return postTaskCompletion(envName, sendToEB);
                })
            }
        }
    })
}

function runTasks(tasks, index, cb){
    if(tasks.length === 0) return cb();
    var thisTask = (tasks.splice(0, 1))[0];
    var success = taskRunner(thisTask, index);
    if(success){
        return runTasks(tasks, index+1, cb);
    }else{
        var message = (tasks.length === 0)? "Continue deploying?" : "Continue executing remaining tasks?";
        mess.yesOrNo(message, rl, (yes) => {
            if(yes){
                return runTasks(tasks, index+1, cb);
            }else{
                endProcess();
            }
        })
    }
}

function postTaskCompletion(envName, sendToEB){
    var packageConfig = config.packageChanges();
    console.log("\n");
    if(packageConfig){
        package.modify(packageConfig, (success) => {
            if(!success){
                mess.yesOrNo("Continue deploying?",rl,(yes) => {
                    if(yes){
                        return commitReleaseBranch(envName, sendToEB);
                    }else{
                        return endProcess();
                    }
                })
            }else{
                return commitReleaseBranch(envName, sendToEB);
            }
        })
    }else{
        return commitReleaseBranch(envName, sendToEB);
    }
}

function commitReleaseBranch(envName, sendToEB){
    var startingBranch = git.getCurrentBranch();
    var releaseBranch = config.releaseName();
    var changes = git.changes();
    var ignored = config.ignoredFiles();
    if(changes.ignored && ignored){
        ignored = ignored.filter((item) => {
            if(changes.ignored.indexOf(item) !== -1) return true;
            return false;
        })
    }else{
        ignored = null;
    }
    console.log("\n");
    //Move to release branch
    mess.status("Creating release branch: \"" + releaseBranch + "\"");
    git.checkout(releaseBranch);
    //Add all changes
    git.add(null, ignored);
    //Commit changes to release branch
    mess.status("Committing all changes" + (ignored? ", and " + ignored.length + " ignored change(s), " : "") + " to the release branch");
    git.commit(envName); //Commit message should look like "<env name> --> <git username> --> <timestamp>"
    console.log("\n");
    deployToEB(envName, startingBranch, sendToEB);
}

function deployToEB(envName, startingBranch, sendToEB){
    if(sendToEB){
        console.log("\n");
        mess.status("STARTED DEPLOYMENT PROCESS WITH EB...");
        mess.warning("This process can take a while (maximum of a 30 minute timeout)");
        eb.deploy(envName);
        mess.success("Finished process to deploy to elastic beanstalk");
        console.log("\n");
        cleanupGit(startingBranch);
        endProcess();
    }else{
        cleanupGit(startingBranch);
        mess.success("SIMULATION SUCCESSFUL");
        endProcess();
    }
}

function cleanupGit(startingBranch){
    var thisBranch = git.getCurrentBranch();
    mess.status("Cleaning up your git environment");
    git.checkout(startingBranch);
    git.deleteBranch(thisBranch); //Safeguard is in place to ensure we never accidentely delete master
    mess.success("Your git environment should be back to where you started");
}



//*******************************USER INTERACTION METHODS*******************
function chooseEBEnvironment(userPicked, cb){
    //Grab env name from arguments first
    var cliEnv = userPicked;
    if(cliEnv.length) cliEnv = cliEnv[cliEnv.length -1].trim();
    else cliEnv = null;
    var ebEnvs = eb.list();
    if(!ebEnvs || !ebEnvs.environments.length){
        error("An Elastic Beanstalk environment has not been established yet. Please check you current directory or run \"$ eb init\" to setup your environment");
        endProcess(true);
    }
    if(cliEnv && ebEnvs.environments.indexOf(cliEnv) !== -1) return cb(cliEnv);
    else{
        mess.ebEnvs(ebEnvs);
        mess.envQuestion(ebEnvs, rl, (envName) => {
            return cb(envName);
        })
    }
}


//********************************HELPER METHODS******************************
function verifyDependencies(){
    if(!git.hasGit || !eb.hasEB){
        if(!git.hasGit) 
            mess.error("MISSING GLOBAL DEPENDENCY \"git\" - Please visit \"https://git-scm.com/downloads\" to download");
        if(!eb.hasEB)
            mess.error("MISSING GLOBAL DEPENDENCY \"eb\" - Please visit \"https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3-install.html\" for installation instructions");
        return endProcess(true);
    }
}
function endProcess(errors){
    if(DID_STASH_CHANGES){
        git.pop();
    }
    console.log(clc[errors? 'red' : 'green']("\n\n******** FINISHED EB RELEASE"+(errors?" WITH ERRORS" : "")+" ********\n\n"));
    process.exit();
}