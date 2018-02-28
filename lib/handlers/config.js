var fs = require('fs'),
    path = require('path'),
    mess = require('../helpers/messenger');

const CONFIG_FILE_NAME = 'ebr.config.js';

module.exports = class ConfigHandler{
    constructor(cwd){
        this.cwd = cwd;
        this.config = { //Seting default config settings
            release: {
                name: "eb-deploy-release",
                keep: true
            }
        };
    }
    load(fileLoc){
        var usingDefault = false;
        if(typeof fileLoc === 'string' && fileLoc !== ''){
            var file = path.resolve(fileLoc);
        }else{
            usingDefault = true;
            var file = path.resolve(this.cwd, CONFIG_FILE_NAME);
        }
        var exists = fs.existsSync(file);
        if(!exists){
            if(!usingDefault)
                mess.error("The specified file does not exist");
            else
                mess.warning("Could not find the default config file("+CONFIG_FILE_NAME+")");
            return false;
        }else if(exists){
            //ATTEMPT TO LOAD THE FILE
            try{
                var data = require(file);
            }catch(e){
                mess.warning("Failed to load " (usingDefault? CONFIG_FILE_NAME : "the specified file"));
                return false;
            }
            var successfulMerge = this.mergeConfig(data);
            if(!successfulMerge) return false;
            return true;
        }else{
            return false;
        }
    }
    getTasks(){
        if(this.config.tasks && this.config.tasks.length)
            return JSON.parse(JSON.stringify(this.config.tasks));
        else
            return false;
    }
    releaseName(){
        return this.config.release.name;
    }
    shouldKeep(){
        return this.config.release.keep;
    }
    ignoredFiles(){
        if(typeof this.config.release.includeIgnored === 'object' && this.config.release.includeIgnored.length)
            return JSON.parse(JSON.stringify(this.config.release.includeIgnored));
        return false;
    }
    packageChanges(){
        if(typeof this.config.package === 'object')
            return JSON.parse(JSON.stringify(this.config.package));
        return false;
    }
    mergeConfig(data){
        if(typeof data === 'object'){
            if(typeof data.release === 'object'){
                if(typeof data.release.name === 'string' && data.release.name !== '') this.config.release.name = (data.release.name.replace(/\s/g,'')).toLowerCase();
                if(typeof data.release.keep === 'boolean') this.config.release.keep = data.release.keep;
                if(typeof data.release.includeIgnored === 'object' && data.release.includeIgnored.length) this.config.release.includeIgnored = JSON.parse(JSON.stringify(data.release.includeIgnored));
            }
            if(typeof data.tasks === 'object' && data.tasks.length) this.config.tasks = JSON.parse(JSON.stringify(data.tasks));
            if(typeof data.package === 'object') this.config.package = JSON.parse(JSON.stringify(data.package));
            return true;
        }
        mess.error("Expected config file to be an object.");
        return false;
    }
}