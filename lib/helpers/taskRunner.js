var mess = require('./messenger'),
    run = require('../helpers/commandRunner').runAsync,
    perf = require('../helpers/performance');

module.exports = function(config, eb, index, cb){
    if(typeof config !== 'object' || typeof config.command !== 'string'){
        mess.warning("Unable to correctly parse settings for task #" + index);
        return cb(false);
    }else if(typeof config === 'object' && typeof config.command === 'string'){
        var validConfig = {
            name: "\"" + (config.name || ("Task #" + index)) + "\"",
            description: (config.description && config.description !== '')? " - " + config.description : "",
            command: config.command,
            timeout: (typeof config.timeout === 'number' && config.timeout >=0)? config.timeout : 0
        }
        //Decide whether to append env name
        if(config.appendEnvName){
            validConfig.command += " --eb-env " + eb.envName;
        }
        retrieveEBEnv(config, eb, (envVars) => {
            if(config.injectEBEnv && envVars === false){
                return cb(false); //Don't run script if we fail to inject environment
            }else if(!config.injectEBEnv){
                envVars = {};
            }
            mess.load("Running "+validConfig.name+validConfig.description);
            perf.start(validConfig.name);
            run(validConfig.command, {timeout: validConfig.timeout, env: envVars}, (results) => {
                mess.stopLoad(true);
                perf.end(validConfig.name);
                if(!results.success){
                    mess.error("Failed to run " + validConfig.name);
                    return cb(false);
                }
                mess.success("Completed "+validConfig.name);
                return cb(true);
            })
        })
    }
}

function retrieveEBEnv(config, eb, cb){
    if(config.injectEBEnv){
        if(typeof config.injectEBEnv === 'string' && config.injectEBEnv !== '')
            var name = config.injectEBEnv;
        else
            var name = eb.envName;
        eb.handler.env(name, (envVars) => {
            if(envVars === false)
                mess.error('Failed to retrieve environment for the given environment');
            return cb(envVars);
        })
    }else{
        return cb(false);
    }
}