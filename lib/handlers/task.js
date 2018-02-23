var mess = require('../messenger'),
    execSync = require('child_process').execSync;

const DEFAULT_DESCRIPTION = "Description: ";
const DEFAULT_INSTALL = "Please check related documentation for your command to ensure proper installation";
const DEFAULT_TIMEOUT = 10000;

module.exports = function(config, index){
    if(typeof config === 'string'){
        config = {
            description: DEFAULT_DESCRIPTION+ config.substr(0,10),
            command: config,
            install: DEFAULT_INSTALL,
            timeout: DEFAULT_TIMEOUT
        }
    }else if(typeof config === 'object' && typeof config.command === 'string'){
        config = {
            description: config.description || (DEFAULT_DESCRIPTION + config.command.substr(0, 10)),
            command: config.command,
            install: config.install || DEFAULT_INSTALL,
            timeout: (typeof config.timeout === 'number' && config.timeout > DEFAULT_TIMEOUT)? config.timeout : DEFAULT_TIMEOUT
        }
    }else{
        mess.warning("Unable to correctly parse settings for task #" + index);
        return false;
    }
    console.log("\n");
    mess.status("Starting task #" + index + "...");
    console.log("--Description: " + config.description);
    try{
        execSync(config.command, {timeout: config.timeout});
    }catch(e){
        mess.error("Failed to complete task #" + index);
        console.log("TO INSTALL: " + config.install);
        return false;
    }
    finishMessage(index);
    return true;
}

function finishMessage(index){
    mess.success("Finished task #" + index);
}