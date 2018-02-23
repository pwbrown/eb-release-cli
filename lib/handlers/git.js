var execSync = require('child_process').execSync;

module.exports = class GitHandler{
    constructor(){
        this.hasGit = this.validate();
        this.username = null;
    }
    //VALIDATES EXISTENCE OF GIT COMMAND
    validate(){
        try{
            var version = execSync('git --version', {timeout:3000, encoding: 'utf8'});
        }catch(e){
            return false;
        }
        if(typeof version === 'string' && version.match(/git version \d+\.\d+\.\d+/i)) return true;
        return false;
    }
    //RETURNS AN OBJECT WITH THE FOLLOWING BOOLEAN STATUSES: "clean", "pull", "push", "other"
    status(cb){
        if(!this.hasGit) return null;
        this.remoteUpdate(); //Update from origin first
        //GET COMMIT HASHES
        try{
            var LOCAL_HASH = execSync('git rev-parse @{0}', {timeout: 3000, encoding: 'utf8'});
            var REMOTE_HASH = execSync('git rev-parse @{u}', {timeout: 3000, encoding: 'utf8'});
            var BASE_HASH = execSync('git merge-base @ @{u}', {timeout: 3000, encoding: 'utf8'});
        }catch(e){
            return null;
        }
        if(typeof LOCAL_HASH  === 'string' && LOCAL_HASH !== '' && typeof REMOTE_HASH === 'string' && REMOTE_HASH !== '' && typeof BASE_HASH === 'string' && BASE_HASH !== ''){
            LOCAL_HASH = LOCAL_HASH.trim(), REMOTE_HASH = REMOTE_HASH.trim(), BASE_HASH = BASE_HASH.trim();
            var clean = false, pull = false, push = false, other = false;
            if(LOCAL_HASH === REMOTE_HASH) clean = true;
            else if(LOCAL_HASH === BASE_HASH) pull = true;
            else if(REMOTE_HASH === BASE_HASH) push = true;
            else other = true;
            return {clean: clean, pull: pull, push: push, other: other};
        }
        return null;
    }
    //ALLOWS GIT TO UPDATE STATUS FROM REMOTE
    remoteUpdate(){
        if(!this.hasGit) return;
        try{
            execSync('git remote update', {timeout: 10000});
        }catch(e){
            return;
        }
    }
    //RETURNS 2 LISTS: a list of "ignored" file changes, and a list of all other "uncommitted" changes
    changes(){
        if(!this.hasGit) return null;
        try{
            var status = execSync('git status --porcelain=1 --ignored', {timeout:3000, encoding: 'utf8'})
        }catch(e){
            return null;
        }
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
        return {untracked: untracked.length? untracked : false, ignored: ignored.length? ignored : false};
    }
    //ADD FILES TO BE COMMITTED: Providing no arguments will add all files (exluding ignored)
    add(files, ignored){
        if(!this.hasGit) return;
        var fileString = '-A'; //By default add all files (excludes ignored files)
        if(typeof files !== 'undefined' && files !== null && files.length) fileString = files.join(" ");
        try{
            execSync('git add ' + fileString, {timeout: 5000});
        }catch(e){
            return;
        }
        if(typeof ignored !== 'undefined' && ignored !== null && ignored.length){
            fileString = ignored.join(" ");
            try{
                execSync('git add -f ' + fileString, {timeout: 5000}); //Ignored files need the -f flag to force add them
            }catch(e){
                return;
            }
        }
    }
    //Will generate a commit message and commit changes to the current branch
    commit(message){
        if(!this.hasGit) return;
        if(typeof message !== 'string' || message === '') message = "Git Commit";
        message = message + " --> " + this.getUsername() + " --> " + (new Date()).toUTCString();
        try{
            execSync('git commit -m \"'+message+'\"', {timeout: 10000});
        }catch(e){
            return;
        }
    }
    //Will push ALL committed changes to the remote origin of the repository
    push(){
        if(!this.hasGit) return;
        try{
            execSync('git push origin', {timeout: 10000});
        }catch(e){
            return;
        }
    }
    //Will pull and merge from the remote origin
    pull(){
        if(!this.hasGit) return;
        try{
            execSync('git pull', {timeout: 10000});
        }catch(e){
            return;
        }
    }
    //Stash local changes
    stash(){
        if(!this.hasGit) return false;
        try{
            //Add all files first
            this.add();
            //Stash them
            execSync('git stash', {timeout: 10000});
            return true;
        }catch(e){
            return false;
        }
    }
    //Pop stashed changes back to user
    pop(){
        if(!this.hasGit) return;
        try{
            execSync('git stash pop', {timeout: 10000});
        }catch(e){
            return;
        }
    }
    //Will checkout/switch to the specified branch (Will create a new branch if one does not exist)
    checkout(branchName){
        if(!this.hasGit) return;
        if(typeof branchName == 'string' && branchName !== ''){
            branchName = branchName.replace(/\s/g, '');
            if(!this.hasBranch(branchName)) branchName = "-b " + branchName; //Add -b flag to create new branch
            try{
                execSync('git checkout ' + branchName, {timeout: 3000});
            }catch(e){
                return;
            }
        }
    }
    //Will delete the specified branch (forcefully) if it exists
    deleteBranch(branchName){
        if(!this.hasGit) return;
        if(typeof branchName == 'string' && branchName !== '' && !branchName.match(/master/i)){ //Ensure that we never even think about deleting the master branch
            branchName = branchName.replace(/\s/g,'');
            if(this.hasBranch(branchName)){
                execSync('git branch -D ' + branchName, {timeout: 5000});
            }
        }
    }
    //Checks to ensure that the specified branch exists in the current repository
    hasBranch(branchName){
        if(!this.hasGit) return false;
        try{
            var branches = execSync('git branch', {timeout: 3000, encoding: 'utf8'})
        }catch(e){
            return false;
        }
        if(typeof branches === 'string' && branches !== ''){
            var branchList = (branches.trim()).split("\n");
            branchList = branchList.map((branch) => {return (branch.replace(/[*]/,'')).trim()});
            if(branchList.indexOf(branchName) !== -1) return true;
        }
        return false;
    }
    //Returns the name of the branch that the user resides in
    getCurrentBranch(){
        if(!this.hasGit) return null;
        try{
            var branch = execSync('git rev-parse --abbrev-ref HEAD', {timeout: 3000, encoding: 'utf8'});
        }catch(e){
            return null;
        }
        if(typeof branch === 'string' && branch.trim() !== '') return branch.trim();
        return null;
    }
    //Attempts to retrieve the git user's name from configuration settings
    getUsername(){
        if(this.username !== null) return this.username;
        try{
            var username = execSync('git config user.name', {timeout: 3000, encoding: 'utf8'});
        }catch(e){
            return 'HUMAN'
        }
        if(typeof username === 'string' && username.trim() !== '') return username.trim();
        return 'HUMAN';
    }
}