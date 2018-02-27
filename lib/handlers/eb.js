var run = require('../helpers/commandRunner').runAsync,
    mess = require('../helpers/messenger'),
    perf = require('../helpers/performance');

module.exports = class EBHandler{
    constructor(){
        this.hasEB = false;
        this.storedEnvs = {};
    }
    //VALIDATE INSTALLATION OF EB CLI
    validate(cb){
        run('eb --version', (results) => {
            if(results.success && results.stdout.match(/eb cli \d+\.\d+\.\d+/i)){ 
                this.hasEB = true;
                return cb(true);
            }else{
                this.hasEB = false;
                return cb(false);
            }
        })
    }
    //RETURNS AN OBJECT WITH 2 VALUES: "environments" - an array list of environments, and "default" - the default environment from eb env settings 
    list(cb){
        if(!this.hasEB) return cb(false);
        run('eb list', (results) => {
            if(results.success){
                var list = results.stdout;
                if(typeof list === 'string' && list !== ''){
                    list = list.trim().split("\n");
                    var defaultEnv = null;
                    list = list.map((listItem) => {
                        listItem = listItem.trim();
                        if(listItem.match(/^[*]\s+.*/)){
                            var env = listItem.replace(/[*]\s+/,'');
                            defaultEnv = env;
                        }else{
                            var env = listItem;
                        }
                        return env;
                    })
                    return cb({
                        environments: list,
                        default: defaultEnv
                    })
                }
                return cb(false);
            }else{
                return cb(false);
            }
        })
    }
    //Returns an object of environment variable from the specified environment
    env(envName, cb){
        if(!this.hasEB) return cb(false);
        //Cache env vars during execution to save or reuse by multiple tasks
        if(typeof this.storedEnvs[envName] !== 'undefined') return cb(this.storedEnvs[envName]);
        mess.load("Retrieving EB Environment vars");
        perf.start("Retrieving EB Environment vars");
        run('eb printenv ' + envName, (results) => {
            mess.stopLoad(true);
            perf.end("Retrieving EB Environment vars");
            if(!results.success) return cb(false);
            else{
                var envs = results.stdout.trim();
                var envList = envs.split("\n");
                var envVars = {};
                envList.forEach(function(item){
                    item = item.trim();
                    var kv = item.split("=");
                    if(kv.length > 1 && kv.length < 3){
                        envVars[kv[0].trim()] = kv[1].trim(); //Set environment variable
                    }
                })
                this.storedEnvs[envName] = envVars;
                return cb(envVars);
            }
        })
    }
    deploy(envName, cb){
        if(!this.hasEB) return cb(false);
        run('eb deploy ' + envName, 1800000, (results) => {
            if(results.success){
                return cb(true);
            }else{
                return cb(false);
            }
        })
    }
}