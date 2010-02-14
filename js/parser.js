/*
%m  	Month as a decimal number [01,12].
%d  	Day of the month as a decimal number [01,31].
%y  	Year without century as a decimal number [00,99].
%Y 	Year with century as a decimal number.

%H  	Hour (24-hour clock) as a decimal number [00,23].
%P:     Hour:Minute AM/PM mode parser, accepts/folds format like 12:20AM 12:20PM
%p.     Hour:Minute am/pm mode parser, accepts/folds format like 12:20am 12:20pm
%M  	Minute as a decimal number [00,59].
%S      Second as a decimal number [00,59].
*/

(function(){

var S = window.__Sakura;

S.DateTokenizer = Class.create({
    initialize: function(str)
    {
        this.str = str;
        this.index = 0;

        this.parse_format = arguments.length > 1 ? arguments.length[1] : false ;
        this.ignore_whitespace = arguments.length > 2 ? arguments.length[2] : true ;
    },
    strtok:function(str)
    {
        return new S.DateTokenizer.Token(S.DateTokenizer.Token.STRING,str);
    },
    numtok:function(digits)
    {
        return new S.DateTokenizer.Token(S.DateTokenizer.Token.NUMBER,S.DateTokenizer.to_decimal(digits));
    },
    next_token: function()
    {
        var digits = [];
        var str = '';

        var strtok = this.strtok;
        var numtok = this.numtok;

        while(true)
        {
            if(this.index == this.str.length)
            {
                if(digits.length)
                    return numtok(digits);
                if(str.length)
                    return strtok(str);
                return new S.DateTokenizer.Token(S.DateTokenizer.Token.END,0);
            }

            var ch = this.str[this.index];
            switch(ch)
            {
                case '\t':
                case ' ':
                case '\n':
                case '\r':
                    if(digits.length)
                        return numtok(digits);
                    if(!this.ignore_whitespace)
                        str+=(ch);
                    break;
                case '0':case '1':case '2':case '3':case '4':
                case '5':case '6':case '7':case '8':case '9':
                    if(str.length)
                        return strtok(str);
                    digits.push(parseInt(ch));
                    break;
                default:
                    if(digits.length)
                        return numtok(digits);
                    str+=(ch);
                    break;
                case '%':
                    if(str.length)
                        return strtok(str);
                    if(digits.length)
                         return numtok(digits);

                    if(this.index == this.str.length)
                        throw new S.DateFormatter.FormatError(S.translate('UnexpectedEnd'),this.str,this.index);

                    ++this.index;
                    var token_name = this.str[this.index++];
                    if( token_name.toLowerCase() == 'p' ){
                        if(this.index == this.str.length){
                            throw new S.DateFormatter.FormatError(S.translate('UnexpectedEnd'),this.str,this.index);
                        }
                        token_name += this.str[this.index++];
                    }

                    return new S.DateTokenizer.Token(S.DateTokenizer.Token.FORMAT,'%'+token_name);

            }

            ++this.index;
        }
    }
});

S.DateTokenizer.to_decimal = function(digits)
{
    var n = 0;
    for(var i = 0; i < digits.length;++i)
        n+=digits[i]*Math.pow(10,digits.length-i-1);
    return n;
};

S.DateTokenizer.Token = Class.create({
    initialize: function(type,value)
    {
        this.type = type;
        this.value = value;
    }
});

S.DateTokenizer.Token.END = 0;
S.DateTokenizer.Token.NUMBER = 1;
S.DateTokenizer.Token.STRING = 2;
S.DateTokenizer.Token.FORMAT = 3;

S.DateSetter = Class.create({
    initialize: function(){
        this.full_year = null;
        this.month = null;
        this.date = null;
        this.hours = null;
        this.minutes = null;
        this.seconds = null;
    },
    setDate: function(date){
        this.date = date;
    },
    setHours: function(hours){
        this.hours = hours;
    },
    setMinutes: function(minutes){
        this.minutes = minutes;
    },
    setSeconds: function(seconds){
        this.seconds = seconds;
    },
    setMonth: function(month){
        this.month = month;
    },
    setFullYear: function(full_year){
        this.full_year = full_year;
    },
    to_date: function(){
        var date = new Date();
        if(this.full_year != null){
            date.setFullYear(this.full_year);
        }
        if(this.month != null){
            date.setMonth(this.month);
        }
        if(this.date != null){
            date.setDate(this.date);
        }
        if(this.hours != null){
            date.setHours(this.hours);
        }
        if(this.minutes != null){
            date.setMinutes(this.minutes);
        }
        if(this.seconds != null){
            date.setSeconds(this.seconds);
        }
        return date;
    }
});

S.DateFormatter = Class.create({

    initialize: function(format_string)
    {
        this.recover = arguments.length > 1 ? arguments[1] : false;

        this.tokens = [];
        var tokenizer = new S.DateTokenizer(format_string,true);
        var token = 0;
        while(true)
        {
            token = tokenizer.next_token();
            if(token.type == S.DateTokenizer.Token.END)
                break;
            this.tokens.push(token);
        }


        this.out_tokens = [];
        tokenizer = new S.DateTokenizer(format_string,true,false);
        token = 0;
        while(true)
        {
            token = tokenizer.next_token();
            if(token.type == S.DateTokenizer.Token.END)
                break;
            this.out_tokens.push(token);
        }
    },

    from_string: function(str){
        try{
            var tokenizer = new S.DateTokenizer(str);
            var token_index = 0;
            var date = new S.DateSetter();
            var token = tokenizer.next_token();
            while(true)
            {
                if(token.type == S.DateTokenizer.Token.END){
                    if(token_index != this.tokens.length){
                        throw new S.DateFormatter.FormatError(
                            S.translate('UnexpectedEnd'),tokenizer.str,tokenizer.index);
                    }
                    else{
                        return date.to_date();
                    }
                }

                if(token_index == this.tokens.length){
                    if(token.type != S.DateTokenizer.Token.END){
                        throw new S.DateFormatter.FormatError(
                            S.translate('UnexpectedEnd'),tokenizer.str,tokenizer.index);
                    }
                    else{
                        return date.to_date();
                    }
                }

                var format_token = this.tokens[token_index];
                if(format_token.type != S.DateTokenizer.Token.FORMAT){
                    if(format_token.type != token.type || format_token.value != token.value){
                        throw new S.DateFormatter.FormatError(
                            S.translate('ExpectedToken',{
                                token:format_token.value
                            }),tokenizer.str,tokenizer.index);
                    }
                    token = tokenizer.next_token();
                }
                else{
                    if(format_token.value.toLowerCase().charAt(1) == 'p'){
                        token = S.DateFormatter.am_pm_time.fs(tokenizer,format_token,token,date);
                    }
                    else{
                        var setter = S.DateFormatter.static_tokens[format_token.value];
                        token = setter.fs(tokenizer,token,date);
                    }

                }

                ++token_index;
            }
        }
        catch(exc){
            if(this.recover){
                return new Date();
            }

            throw exc;
        }

        return date.to_date();
    },

    to_string: function(date)
    {
        var token = 0;
        var str = '';
        for(var i =0;i<this.out_tokens.length;++i)
        {
            token = this.out_tokens[i];
            if(token.type != S.DateTokenizer.Token.FORMAT)
            {
                str+=token.value;
            }
            else
            {
                if(token.value.toLowerCase().charAt(1) == 'p'){
                    str += S.DateFormatter.am_pm_time.ts(token, date);
                }
                else{
                    var getter = S.DateFormatter.static_tokens[token.value];
                    str += getter.ts(date);    
                }

            }
        }
        return str;
    },

    human_readable_format: function()
    {
        var token = 0;
        var str = '';
        for(var i =0;i<this.out_tokens.length;++i)
        {
            token = this.out_tokens[i];
            if(token.type != S.DateTokenizer.Token.FORMAT) {
                str+=token.value;
            }
            else {
                if(token.value.toLowerCase().charAt(1) == 'p'){
                    str += S.DateFormatter.am_pm_time.th();
                }
                else{
                    str += S.DateFormatter.static_tokens[token.value].th();    
                }
            }
        }
        return str;
    }
});


S.DateConverter = {};

S.DateConverter.ampm_to_hours24 = function(hours,am){
    if(am){
        if(hours == 12){
            return 0;
        }
    else{
        return hours;
        }
    }
    else{
        if(hours == 12){
            return 12;
        }
        else{
            return hours + 12;
        }
    }
};

S.DateConverter.hours24_to_ampm = function(hours){
    if(hours == 0){
        return {
            hours: 12,
            ampm: 0
        };
    }
    else if (hours > 0 && hours < 12){
        return {
            hours: hours,
            ampm: 0
        };
    }
    else if(hours == 12){
        return {
            hours: 12,
            ampm: 1
        };
    }
    else{
        return {
            hours: hours - 12,
            ampm: S.Calendar.PM
        };
    }
};

S.DateFormatter.FormatError = Class.create({
    initialize: function(message,str,index)
    {
        this.message = message;
        this.str = str;
        this.index = index;
    },

    get_message: function()
    {
        var msg = this.message + '\n' + this.str + '\n';
        for(var i = 0; i<this.index;++i)
        {
            msg+=' ';
        }

        msg+= '^';
        return msg;
    }
});

S.DateFormatter.am_pm_time = {
    fs: function(tokenizer,format_token,token,date){
        var separator = format_token.value.charAt(2);

        var ampm_hours = S.DateFormatter.expect_number(token,1,12);
        
        token = tokenizer.next_token();
        if (token.type != S.DateTokenizer.Token.STRING || token.value != separator){
            throw new S.DateFormatter.FormatError(
                S.translate('ExpectedToken',{token:separator}),tokenizer.str,tokenizer.index);
        }

        token = tokenizer.next_token();
        var minutes = S.DateFormatter.expect_number(token,0,59);

        token = tokenizer.next_token();
        if (token.type != S.DateTokenizer.Token.STRING ||
            (token.value.toLowerCase() != 'am' &&
             token.value.toLowerCase() != 'pm')){
            throw new S.DateFormatter.FormatError(
                S.translate('ExpectedToken',{token:'am/pm'}),tokenizer.str,tokenizer.index);                
        }


        var is_am = token.value.toLowerCase() == 'am';
        var hours = S.DateConverter.ampm_to_hours24(ampm_hours,is_am);
        
        date.setHours(hours);
        date.setMinutes(minutes);

        return tokenizer.next_token();
    },
    ts: function(format_token, date){
        var separator = format_token.value.charAt(2);
        var lowercase = format_token.value.toLowerCase() == format_token.value;

        var r = S.DateConverter.hours24_to_ampm(date.getHours());
        var ampm = (r.ampm == 0?'AM':'PM');
        if(lowercase){
            ampm = ampm.toLowerCase();
        }
        return  r.hours + separator + S.DateFormatter.to_string(date.getMinutes(),2) + ampm;
    },
    th: function(){ 
        return S.translate('TimeAMPM');
    }
};

S.DateFormatter.static_tokens = {
    '%m': {
        fs: function(tokenizer,token,date){
            date.setMonth(S.DateFormatter.expect_number(token,1,12)-1);
            return tokenizer.next_token();
        },
        ts: function(date){
            return S.DateFormatter.to_string(date.getMonth() + 1,2);
        },
        th: function(){ return S.translate('Month2Digits');}
    },
    '%d': {
        fs: function(tokenizer,token,date){
            date.setDate(S.DateFormatter.expect_number(token,1,31));
            return tokenizer.next_token();
        },
        ts: function(date){
            return S.DateFormatter.to_string(date.getDate(),2);
        },
        th: function(){ return S.translate('Day2Digits');}
    },
    '%y': {
        fs: function(tokenizer,token,date){
            date.setFullYear(S.DateFormatter.expect_number(token,0,99)+2000);
            return tokenizer.next_token();
        },
        ts: function(date){
            return S.DateFormatter.to_string(date.getFullYear() - 2000,2);
        },
        th: function(){ return S.translate('Year2Digits');}
    },
    '%Y': {
        fs: function(tokenizer,token,date){
            date.setFullYear(S.DateFormatter.expect_number(token,0,999999));
            return tokenizer.next_token();
        },
        ts: function(date){
            return S.DateFormatter.to_string(date.getFullYear(),4);
        },
        th: function(){ return S.translate('Year4Digits');}
    },
    '%H': {
        fs: function(tokenizer,token,date){
            date.setHours(S.DateFormatter.expect_number(token,0,23));
            return tokenizer.next_token();
        },
        ts: function(date){
            return S.DateFormatter.to_string(date.getHours(),2);
        },
        th: function(){ return S.translate('Hours24');}
    },
    '%M': {
        fs: function(tokenizer,token,date){
            date.setMinutes(S.DateFormatter.expect_number(token,0,59));
            return tokenizer.next_token();
        },
        ts: function(date){
            return S.DateFormatter.to_string(date.getMinutes(),2);
        },
        th: function(){ return S.translate('Minutes2Digits');}
    },
    '%S': {
        fs: function(tokenizer,token,date){
            date.setSeconds(S.DateFormatter.expect_number(token,0,59));
            return tokenizer.next_token();
        },
        ts: function(date){
            return S.DateFormatter.to_string(date.getSeconds(),2);
        },
        th: function(){ return S.translate('Seconds2Digits');}
    }

};

S.DateFormatter.to_string = function(number,order){
    var str = '';
    var ord = 0;
    while(true){
        if(number ==0){
            break;
        }            
        var x = number - 10*Math.floor(number/10);
        ++ord;
        str = x+str;
        number = Math.floor(number/10);
    }

    for(var i = 0; i<order - ord;++i){
        str = '0'+str;
    }
        
    return str;
};

S.DateFormatter.expect_number = function(token,min,max){
    if (token.type != S.DateTokenizer.Token.NUMBER)
        throw new S.DateFormatter.FormatError(
            S.translate('ExpectedNumber'),token.value);

    if(token.value < min || token.value > max)
        throw new S.DateFormatter.FormatError(
            S.translate('ExpectedRange',{min:min,max:max}),token.value);

    return token.value;
};


/*
%m  	Month as a decimal number [01,12].
%d  	Day of the month as a decimal number [01,31].
%y  	Year without century as a decimal number [00,99].
%Y 	Year with century as a decimal number.

%H  	Hour (24-hour clock) as a decimal number [00,23].
%P      Hour:Minute AM/PM mode parser, accepts/folds format like 12:20am 12:20pm
%M  	Minute as a decimal number [00,59].
*/

S.iso_datetime = new S.DateFormatter("%Y-%m-%dT%H:%M:%S");
S.iso_date = new S.DateFormatter("%Y-%m-%d");
    
})();
