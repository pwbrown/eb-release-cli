var execSync = require('child_process').execSync;

module.exports = class EBHandler{
    constructor(){
        this.hasEB = this.validate();
    }
    //VALIDATE INSTALLATION OF EB CLI
    validate(){
        try{
            var version = execSync('eb --version', {timeout: 3000, encoding: 'utf8'});
        }catch(e){
            return false;
        }
        if(typeof version === 'string' && version.match(/eb cli \d+\.\d+\.\d+/i)) return true;
        return false;
    }
    //RETURNS AN OBJECT WITH 2 VALUES: "environments" - an array list of environments, and "default" - the default environment from eb env settings 
    list(){
        if(!this.hasEB) return null;
        try{
            var list = execSync('eb list', {timeout: 3000, encoding: 'utf8'});
        }catch(e){
            return null;
        }
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
            return {
                environments: list,
                default: defaultEnv
            }
        }
        return null;
    }
    deploy(envName){
        if(!this.hasEB) return;
        try{
            execSync('eb deploy ' + envName, {timeout: 1800000});
        }catch(e){
            return;
        }
    }
}