var clc = require('cli-color');
const CHECK_MARK = '✔';
const X_MARK = '✘';
const COPYRIGHT = '©';

//*************************MESSAGE HELPER METHODS******************

exports.welcome = function(username){
    console.log(clc.green("\n\n******** WELCOME " + username.toUpperCase() + "! ********"));
    console.log(clc.green("******** STARTING EB RELEASE ********\n\n"));
}
exports.error = function(message){
    console.log(clc.red("-" + X_MARK + "-ERROR---: " + message));
}
exports.success = function(message){
    console.log(clc.green("-" + CHECK_MARK + "-SUCCESS-: " + message));
}
exports.warning = function(message){
    console.log(clc.yellow("-!-WARNING-: " + message));
}
exports.status = function(message){
    console.log("---STATUS--: " + message);
}
exports.ebEnvs = function(ebEnvs){
    console.log("Elastic Beanstalk Application Environments:");
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
    rlRef.question('Choose environment by ID (or press enter to select the default): ', (answer) => {
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

exports.char = {
    check: CHECK_MARK,
    x: X_MARK,
    copy: COPYRIGHT
}