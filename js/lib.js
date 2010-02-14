//looks like a namespace
(function(){

if(typeof window.__Sakura != 'undefined'){
    throw new Exception('names collision detected: Sakura is already defined');
}     

window.__Sakura = {};
var S = window.__Sakura;

S.redirect = function(location)
{
    document.location = location;
};

S.IdBase = {
    make_id: function(suffix){
        return this.id+'_'+suffix;
    },
    el: function(suffix){
        return document.getElementById(this.make_id(suffix));
    },
    extract_id: function(id){
        return id.substring(this.id.length+1,id.length);//+1 is for _
    }
};

S.UniqueClass = Class.create({
    initialize:function(){
        if(arguments.length < 1){
            this.base = ((new Date()).getTime())+'';
        }
        else{
            this.base = arguments[0];
        }

        this.counter = 0;
    },
    id: function(){
        return this.base + '_' + (++this.counter);
    }
});

S.Unique = new S.UniqueClass();

S.uid = function(){
    return S.Unique.id();
};

//extend object
S.mixin = function(class_,props){
    Object.extend(class_.prototype,props);
};

//evaluate templates
S.teval = function(template_str,params)
{
    var t = new Template(template_str);
    return t.evaluate(params);
};

S.Constants = {
    MODULE_NAME : 'SACalendars'
};

S.Url = {};

S.Url.construct = function(target,args){
    var url = target[0] == '/'?target:S.Session.baseurl+target;
    var first = true;
    for( var arg in args ) {
    	var val = args[arg];
        if( first ) {
            url+="?";
            first = false;
        }
        else {
            url+="&";
        }
    	url+=arg+"="+val;
    }
    return url;
};

S.url = S.Url.construct;

S.Url.append = function(target,args){
    var url = ""+target;
    var arg;
    for(arg in args){
    	var val = args[arg];
	url+="&"+arg+"="+val;
    }
    return url;
};

S.empty_string = function(s)
{
    return (s == null || s == '' || /^\s+$/.test(s));
};

})();