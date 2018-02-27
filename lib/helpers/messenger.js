var clc = require('cli-color'),
    Spinner = require('cli-spinner').Spinner;

//SETUP LOADING SPINNERS
var spinner = new Spinner();
spinner.setSpinnerString('|/-\\'); //Character sequence to define the spinner

var WAS_SPINNING = false;

//SETUP SPECIAL CHARACTERS
const CHARS = {
    check: '✔',
    x: '✖',
    em: '!',
    hour: '⌛',
    copy: '©'
}

//RECORD STATUS OF CLI "VERBOSE" OPTION
var IS_VERBOSE = false;
var SHOW_PERFORMANCE = false;

//*************************MESSAGE HELPER METHODS******************

//Export special characters
exports.chars = CHARS;
//Indicate to messenger that we have entered verbose mode
exports.setVerbose = function(verbose){
    IS_VERBOSE = verbose;
}
exports.setPerformance = function(performance){
    SHOW_PERFORMANCE = performance;
}
//Welcomes user
exports.welcome = function(username){
    preCheck();
    console.log(clc.green("-- STARTING EB RELEASE -> Welcome " + username + " --"));
    postCheck();
}
//Red error message
exports.error = function(message){
    preCheck();
    console.log(clc.red(" " + CHARS.x + " ERROR       : ") + message);
    postCheck();
}
//Green success message
exports.success = function(message){
    preCheck();
    console.log(clc.green(" " + CHARS.check + " SUCCESS     : ") + message);
    postCheck();
}
//Yellow warning message
exports.warning = function(message){
    preCheck();
    console.log(clc.yellow(" " + CHARS.em + " WARNING     : ") + message);
    postCheck();
}
//Yellow performance message
exports.performance = function(message){
    if(SHOW_PERFORMANCE){
        preCheck();
        console.log(clc.yellow(" " + CHARS.hour + " PERFORMANCE : ") + message);
        postCheck();
    }
}
//Magenta status message
exports.status = function(message){
    if(IS_VERBOSE){
        preCheck();
        console.log(clc.magenta("   STATUS      : ") + message);
        postCheck();
    }
}
//Starts loading spinner and sets message
exports.load = function(message){
    spinner.setSpinnerTitle(message);
    spinner.start();
}
//Stops loading spinner and sets message
exports.stopLoad = function(shouldClear){
    var clean = typeof shouldClear === 'boolean'? shouldClear : false;
    spinner.stop(clean);
}
exports.ebEnvs = function(ebEnvs){
    console.log("\nElastic Beanstalk Application Environments:");
    console.log("___________________________________________");
    console.log("--ID-- | --ENVIRONMENT NAME--");
    ebEnvs.environments.forEach((envName, index) => {
        var id = index + 1;
        var row = "  " + (id < 10? " "+id : id) + "   |   " + envName;
        if(envName == ebEnvs.default)
            console.log(row + clc.green("           *DEFAULT*"));
        else
            console.log(row);
    })
}
//Asks user which enironment to use given a list of enironments
exports.envQuestion = function(ebEnvs, rlRef, cb){
    var _this = this;
    rlRef.question('\nChoose environment by ID (or press enter to select the default): ', (answer) => {
        if(typeof answer === 'string'){
            if(answer === '') return cb(ebEnvs.default);
            else{
                answer = answer.trim();
                if(answer.match(/^[0-9]+$/)){
                    answer = parseInt(answer);
                    if(answer > 0 && answer <= ebEnvs.environments.length){
                        return cb(ebEnvs.environments[answer - 1]);
                    }
                }
                _this.error("Invalid selection, please try again");
                return envQuestion(ebEnvs, rlRef, cb);
            }
        }else{
            _this.error("Something went wrong, please try again");
            envQuestion(ebEnvs, rlRef, cb);
        }
    })
}
//Asks the user a yes or no question with the given message
exports.yesOrNo = function(message, rlRef, cb){
    var _this = this;
    rlRef.question(message + " (Y|n): ", (answer) => {
        var yes = ['yes','y',''];
        var no = ['n','no'];
        if(typeof answer === 'string'){
            answer = (answer.trim()).toLowerCase();
            if(yes.indexOf(answer) !== -1) return cb(true);
            else if(no.indexOf(answer) !== -1) return cb(false);
            else{
                _this.error("Invalid answer, please try again");
                return _this.yesOrNo(message, rlRef, cb);
            }
        }else{
            _this.error("Something went wrong, please try again");
            return _this.yesOrNo(message, rlRef, cb);
        }
    })
}
//Displays message for goodbye
exports.endProcess = function(hasErrors){
    console.log("\n" + clc[hasErrors? 'red' : 'green']("-- FINISHED EB RELEASE"+(hasErrors?" WITH ERRORS" : "")+" --"));
}

//Clears spinner to display a new message if the spinner was active
function preCheck(){
    if(spinner.isSpinning()){
        WAS_SPINNING = true;
        spinner.stop(true);
    }
}

//Puts spinner back after message if it was active
function postCheck(){
    if(WAS_SPINNING){
        WAS_SPINNING = false;
        spinner.start();
    }
}