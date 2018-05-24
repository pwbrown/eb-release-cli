/**
 * @file Manages the interaction with an "ebr.config.js" config file
 * @copyright Philip Brown 2018
 * @author Philip Brown
 * @module configHandler
 * @license MIT
 */

'use strict';

/** DEPENDENCIES */
var fs = require('fs'),
    path = require('path'),
    mess = require('../helpers/messenger');

/**
 * Default name for the ebr config file
 * @constant {string} CONFIG_FILE_NAME
 * */
const CONFIG_FILE_NAME = 'ebr.config.js';

/**
 * @class
 * @classdesc Reads, parses, and stores configuration settings from the config file
 */
module.exports = class ConfigHandler{
    /**
     * Instantiates an instance of the ConfigHandler with bare-minimum default settings
     * @param {String} cwd The working directory of execution (process.cwd())
     */
    constructor(cwd){
        this.cwd = cwd;
        this.config = { //Seting default config settings
            release: {
                name: "eb-deploy-release",
                keep: true
            }
        }
    }
    /**
     * Used to load a config file and merge its settings with the existing config model
     * @param {?string} [fileLoc=module.configHandler~CONFIG_FILE_NAME] Optional config file location 
     * @returns {boolean} Whether the file was loaded and merged successfully
     */
    load(fileLoc){
        //Get the config file location
        var usingDefault = false;
        if(typeof fileLoc === 'string' && fileLoc !== ''){
            var file = path.resolve(fileLoc);
        }else{
            usingDefault = true;
            var file = path.resolve(this.cwd, CONFIG_FILE_NAME);
        }

        //Determine file existence
        var exists = fs.existsSync(file);
        if(!exists){
            if(!usingDefault)
                mess.error("The specified file does not exist");
            else
                mess.warning("Could not find the default config file("+CONFIG_FILE_NAME+")");
            return false;
        }else if(exists){
            //Attempt to load the file as a module
            try{
                var data = require(file);
            }catch(e){
                mess.warning("Failed to load " (usingDefault? CONFIG_FILE_NAME : "the specified file"));
                return false;
            }
            //Parse and merge the file settings with this instance's config model
            var successfulMerge = this.mergeConfig(data);
            if(!successfulMerge) return false;
            return true;
        }else{
            return false;
        }
    }
    /**
     * Returns a copy of the configuration tasks array
     * @returns {(object[]|boolean)}
     */
    getTasks(){
        if(this.config.tasks && this.config.tasks.length)
            return JSON.parse(JSON.stringify(this.config.tasks));
        else
            return false;
    }
    /**
     * Returns a copy of the Github release branch name
     * @returns {string}
     */
    releaseName(){
        return this.config.release.name;
    }
    /**
     * Returns the decision to keep or discard the release branch after deployment
     * @returns {boolean}
     */
    shouldKeep(){
        return this.config.release.keep;
    }
    /**
     * Returns a copy of the list of files that should also be committed to the release branch but are normally ignored
     * @returns {(object[]|boolean)}
     */
    ignoredFiles(){
        if(typeof this.config.release.includeIgnored === 'object' && this.config.release.includeIgnored.length)
            return JSON.parse(JSON.stringify(this.config.release.includeIgnored));
        return false;
    }
    /**
     * Returns a copy of the confuration object housing change requirements to the package.json file
     * @returns {object}
     */
    packageChanges(){
        if(typeof this.config.package === 'object')
            return JSON.parse(JSON.stringify(this.config.package));
        return false;
    }
    /**
     * Merges configuration settings from the config file into the instances's config model
     * @param {Object} data 
     */
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