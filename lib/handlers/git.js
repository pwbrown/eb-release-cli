var run = require('../helpers/commandRunner').runAsync;

module.exports = class GitHandler{
    constructor(){
        this.hasGit = false;
        this.username = null;
    }
    //VALIDATES EXISTENCE OF GIT COMMAND
    validate(cb){
        run('git --version', (results) => {
            if(results.success && results.stdout.match(/git version \d+\.\d+\.\d+/i)){
                this.hasGit = true;
                return cb(true);
            }else{
                this.hasGit = false;
                return cb(false);
            }
        })
    }
    //RETURNS AN OBJECT WITH THE FOLLOWING BOOLEAN STATUSES: "clean", "pull", "push", "other"
    status(cb){
        if(!this.hasGit) return cb(null);
        this.remoteUpdate(() => {
            run('git rev-parse @{0}', (localResults) => {
                run('git rev-parse @{u}', (remoteResults) => {
                    run('git merge-base @ @{u}', (baseResults) => {
                        if(!localResults.success || !remoteResults.success || !baseResults.success)
                            return cb(null);
                        var LOCAL_HASH = localResults.stdout.trim();
                        var REMOTE_HASH = remoteResults.stdout.trim();
                        var BASE_HASH = baseResults.stdout.trim();
                        var clean = false, pull = false, push = false, other = false;
                        if(LOCAL_HASH === REMOTE_HASH) clean = true;
                        else if(LOCAL_HASH === BASE_HASH) pull = true;
                        else if(REMOTE_HASH === BASE_HASH) push = true;
                        else other = true;
                        return cb({clean: clean, pull: pull, push: push, other: other});
                    })
                })
            })
        })
    }
    //ALLOWS GIT TO UPDATE STATUS FROM REMOTE
    remoteUpdate(cb){
        if(!this.hasGit) return cb();
        run('git remote update', () => {
            return cb();
        })
    }
    //RETURNS 2 LISTS: a list of "ignored" file changes, and a list of all other "uncommitted" changes
    changes(cb){
        if(!this.hasGit) return cb(null);
        run('git status --porcelain=1 --ignored', (results) => {
            if(!results.success) return cb(null);
            var status = results.stdout;
            var list = (status.trim()).split("\n");
            var untracked = [];
            var ignored = [];
            list.forEach((change) => {
                var changeParts = (change.trim()).split(" ");
                if(changeParts && changeParts.length){
                    if(changeParts[0] === '!!') ignored.push(changeParts[1]);
                    else untracked.push(changeParts[1]);
                }
            })
            return cb({untracked: untracked.length? untracked : false, ignored: ignored.length? ignored : false});
        })
    }
    //ADD FILES TO BE COMMITTED: Providing no arguments will add all files (exluding ignored)
    add(files, ignored, cb){
        if(typeof files === 'function'){
            cb = files;
            files = null;
        }else if(typeof ignored === 'function'){
            cb = ignored;
            ignored = null;
        }
        if(!this.hasGit) return cb(false);
        var fileString = '-A'; //By default add all files (excludes ignored files)
        if(typeof files !== 'undefined' && files !== null && files.length) fileString = files.join(" ");
        run('git add ' + fileString, (results) => {
            if(!results.success) return cb(false);
            if(typeof ignored !== 'undefined' && ignored !== null && ignored.length){
                fileString = ignored.join(" ");
                run('git add -f ' + fileString, (results) => {
                    if(!results.success) return cb(false);
                    return cb(true);
                })
            }else{
                return cb(true);
            }
        })
    }
    //Will generate a commit message and commit changes to the current branch
    commit(message, cb){
        if(!this.hasGit) return cb(false);
        if(typeof message !== 'string' || message === '') message = "Git Commit";
        this.getUsername((username) => {
            message = message + " --> " + username + " --> " + (new Date()).toUTCString();
            run('git commit -m \"' + message + '\"', (results) => {
                if(!results.success) return cb(false);
                return cb(true);
            })
        })
    }
    //Will push ALL committed changes to the remote origin of the repository (pushes branch if provided)
    push(branch, cb){
        var pushBranch = false;
        if(typeof branch === 'string' && branch !== '') pushBranch = true;
        else if(typeof branch === 'function') cb = branch;
        if(!this.hasGit) return cb(false);
        var command = 'git push -u origin' + (pushBranch? ' ' + branch : '');
        run(command, (results) => {
            if(!results.success) return cb(false);
            return cb(true);
        })
    }
    //Will pull and merge from the remote origin
    pull(cb){
        if(!this.hasGit) return cb(false);
        run('git pull', (results) => {
            if(!results.success) return cb(false);
            return cb(true);
        })
    }
    //Stash local changes
    stash(cb){
        if(!this.hasGit) return cb(false);
        //ADD ALL CHANGES FIRST BEFORE STASHING
        this.add(() => {
            run('git stash', (results) => {
                if(!results.success) return cb(false);
                return cb(true);
            })
        })
    }
    //Pop stashed changes back to user
    pop(cb){
        if(!this.hasGit) return cb(false);
        run('git stash pop', (results) => {
            if(!results.success) return cb(false);
            return cb(true);
        })
    }
    //Will checkout/switch to the specified branch (Will create a new branch if one does not exist)
    checkout(branchName, cb){
        if(!this.hasGit || typeof branchName !== 'string' || branchName === '') return cb(false);
        branchName = branchName.replace(/\s/g, '');
        this.hasBranch(branchName, (hasBranch) => {
            if(!hasBranch) branchName = "-b " + branchName;
            run('git checkout ' + branchName, (results) => {
                if(!results.success) return cb(false);
                return cb(true);
            })
        })
    }
    //Will delete the specified branch (forcefully) if it exists
    deleteBranch(branchName, cb){
        if(!this.hasGit || typeof branchName !== 'string' || branchName === '' || branchName.match(/master/i)) return cb(false); //Never delete master branch
        branchName = branchName.replace(/\s/g,'');
        this.hasBranch(branchName, (hasBranch) => {
            if(!hasBranch) return cb(false);
            run('git branch -D ' + branchName, (results) => {
                if(!results.success) return cb(false);
                return cb(true);
            })
        })
    }
    //Checks to ensure that the specified branch exists in the current repository
    hasBranch(branchName, cb){
        if(!this.hasGit) return cb(false);
        run('git branch', (results) => {
            if(!results.success) return cb(false);
            var branches = results.stdout.trim();
            var branchList = branches.split("\n");
            branchList = branchList.map((branch) => {return (branch.replace(/[*]/,'')).trim()}); //Remove star for current branch item
            if(branchList.indexOf(branchName) !== -1) return cb(true);
            return cb(false);
        })
    }
    //Returns the name of the branch that the user resides in
    getCurrentBranch(cb){
        if(!this.hasGit) return cb(false);
        run('git rev-parse --abbrev-ref HEAD', (results) => {
            if(!results.success) return cb(false);
            return cb(results.stdout.trim());
        })
    }
    //Attempts to retrieve the git user's name from configuration settings
    getUsername(cb){
        if(this.username !== null) return cb(this.username);
        if(!this.hasGit) return cb('HUMAN');
        run('git config user.name', (results) => {
            if(!results.success)
                this.username = 'HUMAN'
            else
                this.username = results.stdout.trim();
            return cb(this.username);
        })
    }
}