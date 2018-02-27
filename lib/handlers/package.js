var path = require('path'),
    readJSON= require('read-package-json'),
    fs = require('fs'),
    run = require('../helpers/commandRunner').runAsync,
    mess = require('../helpers/messenger');

//Built using "https://github.com/npm/init-package-json/blob/master/init-package-json.js" as a reference

module.exports = class PackageHandler{
    constructor(cwd){
        this.cwd = cwd; //Store the cwd from eb-release
    }
    //Used to make specific changes to package.json
    modify(options, cb){
        if(typeof cb !== 'function') cb = function(err, success){if(err)console.log(err);};
        this.load((data) => {
            if(data){
                if(typeof options == 'object'){
                    var madeChange = false;
                    var status = false;
                    //****************APPLY PACKAGE.JSON CHANGES*****************
                    if(typeof options.moveToDev === 'object' && options.moveToDev.length){
                        status = this.moveDependencies(options.moveToDev, true, data);
                        if(status) madeChange = true;
                    }
                    if(typeof options.moveFromDev === 'object' && options.moveFromDev.length){
                        status = this.moveDependencies(options.moveFromDev, false, data);
                        if(status) madeChange = true;
                    }
                    if(typeof options.scripts === 'object'){
                        status = this.applyScriptChanges(options.scripts, data);
                        if(status) madeChange = true;
                    }
                    if(madeChange){
                        this.save(data, (success) => {
                            if(success){
                                this.lock((successfulLock) => {
                                    if(successfulLock){
                                        return cb(true);
                                    }else{
                                        return cb(false);
                                    }
                                })
                            }else{
                                return cb(false);
                            }
                        })
                    }else{
                        return cb(true);
                    }
                }else{
                    mess.error('INVALID OPTIONS FOR PACKAGE.JSON MODIFY');
                    return cb(false);
                }
            }else{
                mess.error('FAILED TO LOAD PACKAGE.JSON FILE');
                return cb(false);
            }
        })
    }
    //Used to load package.json from the CWD - Almost identical to how npm loads package.json files
    load(cb){
        var packageFile = path.resolve(this.cwd, 'package.json');
        readJSON(packageFile, (err, data) => {
            if(err) return cb(null);
            else{
                return cb(data);
            }
        })
    }
    //Save changes to package.json
    save(data, cb){
        var packageFile = path.join(this.cwd, 'package.json');
        data = JSON.stringify(data, null, 2); //Turn into formatted json string
        fs.writeFile(packageFile, data, 'utf8', function(err){
            if(err){
                mess.error("Failed to save changes to package.json");
                return cb(false);
            }
            mess.status("Saved changes to package.json file");
            return cb(true);
        })
    }
    //Create an npm shrinkwrap lock file (Always overrides package-lock.json)
    lock(cb){
        mess.status("Generating new lock file \"npm-shrinkwrap.json\" to override/replace \"package-lock.json\"");
        run('npm shrinkwrap', (results) => {
            if(!results.success){
                mess.error("Failed to generate new lock file.");
                return cb(false);
            }else{
                mess.status("Finished generating new lock file.");
                return cb(true);
            }
        })
    }
    //Remove a list of dependencies to and from the list of devDependencies (DOES NOT CREATE OR REMOVE EXISTING DEPENDENCIES)
    moveDependencies(toMove, toDev, data){
        var madeChange = false;
        toMove.forEach((dep) => {
            if(toDev && data.dependencies && typeof data.dependencies[dep] !== 'undefined'){ //Move devDependency to dependency
                if(typeof data.devDependencies === 'undefined') data.devDependencies = {};
                data.devDependencies[dep] = data.dependencies[dep];
                delete data.dependencies[dep];
                madeChange = true;
            }else if(data.devDependencies && typeof data.devDependencies[dep] !== 'undefined'){ //Move dependency to devDependency
                if(typeof data.dependencies === 'undefined') data.dependencies = {};
                data.dependencies[dep] = data.devDependencies[dep];
                delete data.devDependencies[dep];
                madeChange = true;
            }
        })
        mess.status("Moved " + toMove.length + (!toDev? " devDependencies to dependencies." : " dependencies to devDependencies."));
        return madeChange;
    }
    //Makes changes to package.json npm scripts (setting a script to false will remove the existing script);
    applyScriptChanges(scripts, data){
        if(typeof scripts === 'object' && typeof data === 'object'){
            var changed = 0;
            var removed = 0;
            for(var name in scripts){
                if(typeof data.scripts === 'undefined') data.scripts = {};
                if(typeof scripts[name] === 'string' && typeof scripts[name] !== ''){
                    changed++;
                    data.scripts[name] = scripts[name];
                }else if(typeof scripts[name] === 'boolean' && !scripts[name] && typeof data.scripts[name] === 'string'){
                    removed++;
                    delete data.scripts[name];
                }
            }
            if(changed.length || removed.length){
                mess.status("Modified " + changed.length + " package scripts, and removed " + removed.length + ".");
                return true;
            }
        }
        return false;
    }
}