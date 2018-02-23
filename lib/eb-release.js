//DEPENDENCIES - from a galaxy far far away
var yargs = require('yargs'),
    EBHandler = require('./handlers/eb'),
    PackageHandler = require('./handlers/package'),
    GitHandler = require('./handlers/git'),
    ConfigHandler = require('./handlers/config'),
    clc = require('cli-color'),
    readline = require('readline'),
    mess = require('./messenger');

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
    .command('deploy', 'deploy application to elastic beanstalk environment', () => {}, deploy) //FIRES DEPLOY FUNCTION WHEN DEPLOY COMMAND IS GIVEN
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

function deploy(args){
    //WELCOME THE USER - It's the polite thing to do
    mess.welcome(git.getUsername());
    //VERIFY DEPENDENCIES
    verifyDependencies();
    //DETERMINE EB APPLICATION NAME - Provided through cli option or by direct user input
    chooseEBEnvironment(args._, (envName) => {
        var didLoadConfig = config.load(args.file);
        if(!didLoadConfig){
            mess.yesOrNo('Would you like to continue deploying anyways?', rl, (yes) => {
                if(yes){
                    //Should start eb deploy now (there are no changes)
                    console.log("Should deploy");
                }
                endProcess();
            })
        }else{
            var tasks = config.getTasks();
            if(tasks){
                console.log(tasks.length);
            }
            endProcess();
        }
    })
}




//*******************************USER INTERACTION METHODS*******************
function chooseEBEnvironment(userPicked, cb){
    return cb('beheard2');
    //Grab env name from arguments first
    var cliEnv = userPicked;
    if(cliEnv.length) cliEnv = cliEnv[0].trim();
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
    console.log(clc[errors? 'red' : 'green']("\n\n******** FINISHED EB RELEASE"+(errors?" WITH ERRORS" : "")+" ********\n\n"));
    process.exit();
}