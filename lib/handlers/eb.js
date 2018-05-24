/**
 * @file Manages the interaction with the pertinent AWS EB CLI commands
 * @copyright Philip Brown 2018
 * @author Philip Brown
 * @module ebHandler
 * @license MIT
 */

'use strict';

/** DEPENDENCIES */
var run = require('../helpers/commandRunner').runAsync,
    mess = require('../helpers/messenger'),
    perf = require('../helpers/performance');

/**
 * Default timeout in milliseconds for EB Deployment before the script runs cleanup
 * @constant {number} DEPLOYMENT_TIMEOUT
 */
const DEPLOYMENT_TIMEOUT = 1800000;

/**
 * @class
 * @classdesc Handles interactions with the EB CLI
 */
module.exports = class EBHandler{
    /**
     * Instantiates a copy of the EBHandler.
     * Holds the status of the EB CLI Installation.
     * Holds EB Environment variables if requested.
     */
    constructor(){
        this.hasEB = false;
        this.storedEnvs = {};
    }
    /**
     * Validates the installation of the EB CLI on the local machine
     * @param {EBHandler~validationCallback} cb
     */
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
    /**
     * Returns a list of Environments in the application and the default environment if available
     * @param {EBHandler~listCallback} cb 
     */
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
    /**
     * Retrieves and caches environment variables for the enironment of choice
     * @param {String} envName The environment name to retrieve variables for
     * @param {EBHandler~envCallback} cb 
     */
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
    /**
     * Deploys the current branch to elastic beanstalk for the chosen environment
     * @param {String} envName
     * @param {EBHandler~deployCallback} cb 
     */
    deploy(envName, cb){
        if(!this.hasEB) return cb(false);
        run('eb deploy ' + envName, DEPLOYMENT_TIMEOUT, (results) => {
            if(results.success){
                return cb(true);
            }else{
                return cb(false);
            }
        })
    }
}

/**
 * EBHandler validation callback
 * @callback EBHandler~validationCallback
 * @param {boolean} validationStatus
 */

/**
 * EBHandler list callback
 * @callback EBHandler~listCallback
 * @param {(Object|boolean)} details Holds details about the environments
 * @param {Object[]} details.environments List of environments within the EB application
 * @param {String} details.default The name of the configured default environment
 */

/**
 * EBHandler env callback
 * @callback EBHandler~envCallback
 * @param {(Object|boolean)} envVars Contains key-value pairs for the environment variables
 */

 /**
 * EBHandler deployment callback
 * @callback EBHandler~deployCallback
 * @param {!boolean} success Whether the deployment succeeded on not
 */