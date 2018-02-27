var exec = require('child_process').exec,
    execSync = require('child_process').execSync;

exports.runSync = function(command, timeout, env){
    if(typeof timeout !== 'number' || timeout < 0){
        timeout = 3000;
    }
    try{
        var stdout = execSync(command, {timeout: timeout, encoding: 'utf8'});
    }catch(e){
        return {success:false};
    }
    return {success: true, stdout: stdout};
}

exports.runAsync = function(command, options, cb){
    if(typeof options === 'function'){
        cb = options;
        options = {timeout: 0};
    }
    if(typeof options === 'number' && options >= 0){
        options = {timeout: 0}
    }else if(typeof options === 'object'){
        if(typeof options.timeout !== 'number' || options.timeout < 0) options.timeout = 0;
        else options.timeout = Math.floor(options.timeout);
        if(typeof options.env !== 'object' || !Object.keys(options.env).length) options.env = undefined;
    }
    exec(command, {timeout: options.timeout, encoding: 'utf8', env: options.env}, function(err, stdout, stderr){
        if(err) return cb({success: false});
        else return cb({success: true, stdout: stdout});
    })
}