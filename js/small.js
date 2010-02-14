(function(){

var S = window.__Sakura;
     
S.DateUtils = {
    adjust_to_mon: function(day){
        return (day + 6)%7;
    },
    adjust_to_sun: function(day){
        return (day+1)%7;
    },
    days_diff: function(start,end){
        if(start > end){
            return 7 - start + end;
        }
        else{
            return end - start;
        }
    },
    get_month_dates:function(date,week_starts){
        //last day of prev month
        var start_date = S.DateUtils.clone_date(date);
        start_date.setDate(0);
        start_date.setHours(0,0,0,0,1);
        var days_distance = 0;
        //adjust to something that i would understand - Mon is 0, Tue is 1
        //instead of default Sun - 0 ...
        var last_day = (start_date.getDay() + 6)%7;
        if(week_starts > last_day){
            days_distance = 7 - week_starts+last_day;
        }
        else{
            days_distance = last_day - week_starts;
        }

        start_date.setDate(start_date.getDate() - days_distance);

        var days = 7;
        var rows = 6;
        var results = new Array(rows);
        for(var i = 0; i< rows;++i){
            results[i] = new Array(days);
            for(var j = 0; j< days;++j){
                results[i][j] = S.DateUtils.clone_date(start_date);
                start_date.setDate(start_date.getDate()+1);
            }
        }

        return results;
    },
    clone_date: function(date){
        var ndate = new Date();
        ndate.setTime(date.getTime());
        return ndate;
    },
    set_month_and_date: function(dt, month, date){
        dt.setDate(1);
        dt.setMonth(month);
        dt.setDate(date);
    }
};


S.Calendar = Class.create({
    initialize:function(parameters){
        this.id = S.uid();
        this.options = Object.extend({
            class_name: 'sakura_calendar',
            translate: S.translate,
            week_starts_from: S.Calendar.Mon,
            region_select:false,
            region_select_grab_week: false,
            time: false,
            time_format: S.Calendar.AMPM,
            now: new Date(),
            decorator: new S.Calendar.Decorator(),
            on_change: Prototype.emptyFunction,
            on_region_select: Prototype.emptyFunction
        },parameters);

        this.date = null;
        this.mouse_action = null;
        this.mouse_element = null;
        this.document_mousedown_el = null;
        this.document_mousedown_inside = null;
        this.disabled = false;

        if('inline' in this.options){
            if(this.options.time == true){
                throw new Exception('time input is not supported for inline calendar');
            }
            this.create_interface($(this.options.inline));
            this.set_date(this.options.now);
        }
        else if('input' in this.options){
            if(!('input_format' in this.options)){
                throw new Exception('please specify input_format');
            }
            var input = this.options.input = $(this.options.input);
            if(input == null){
                throw new Exception('input element '+this.options.input+' was not found');
            }
            this.formatter = new S.DateFormatter(this.options.input_format,true);
            this.create_interface(document.getElementsByTagName('body')[0]);
            this.div = $(this.id);
            this.div.hide();
            this.set_date(this.formatter.from_string(input.value));
            //attach observers
            this.on_document_mousedown_ = this.on_document_mousedown.bindAsEventListener(this);
            this.on_document_mouseup_ = this.on_document_mouseup.bindAsEventListener(this);
            Element.observe(document,'mousedown',this.on_document_mousedown_);
            Element.observe(document,'mouseup',this.on_document_mouseup_);
        }
        else{
            throw new Exception('please specify "anchor" or "inline" positioning');
        }
    },
    label:function(label){
        if(arguments.length > 1)
            return this.options.translate(label,arguments[1]);
        else
            return this.options.translate(label);
    },
    clone_date: function(date){
        return S.DateUtils.clone_date(date);
    },
    set_date:function(date){
        this.dates = this.render_date(date);
        this.date = date;
    },
    coords_to_date:function(x,y){
        var date = this.clone_date(this.date);
        var celldate = this.dates[y][x];

        S.DateUtils.set_month_and_date(date,celldate.month,celldate.date);

        var dmonth = this.date.getMonth();
        if(dmonth == 0 && celldate.month == 11){
            date.setYear(date.getFullYear() - 1);
        }
        else if(dmonth == 11 && celldate.month == 0){
            date.setYear(date.getFullYear() + 1);
        }

        return date;
    },
    date_to_coords: function(d){
        var month = d.getMonth();
        var date = d.getDate();
        for(var i = 0;i<6;++i){
            for(var j = 0;j<7;++j){
                var celldate = this.dates[i][j];
                if(celldate.getDate() == date && celldate.getMonth() == month){
                    return {
                        x: j,
                        y: i
                    };
                }
            }
        }
        throw new Error('date not found!');
    },
    disable: function(){
        this.disabled = true;
        if(this.div.visible()){
            this.div.hide();
        }
    },
    enable: function(){
        this.disabled = false;
    },
    destroy: function(){
        var table = this.table;
        this.table = null;
        table.stopObserving('mousedown',this.on_mousedown_);
        table.stopObserving('mouseup',this.on_mouseup_);
        this.on_mousedown_ = null;
        this.on_mouseup_ = null;

        if('input' in this.options){
            Element.stopObserving(document,'mousedown',this.on_document_mousedown_);
            Element.stopObserving(document,'mouseup',this.on_document_mouseup_);
            this.on_document_mousedown_ = this.on_document_mousedown.bindAsEventListener(this);
            this.on_document_mouseup_ = this.on_document_mouseup.bindAsEventListener(this);
        }

        //validate hours and minutes
        if(this.options.time){
            $(this.make_id('hours')).stopObserving('change',this.on_hours_change_);
            $(this.make_id('minutes')).stopObserving('change',this.on_minutes_change_);
            $(this.make_id('on_ok')).stopObserving('click',this.on_ok_);

            this.on_hours_change_ = null;
            this.on_minutes_change_ = null;
            this.on_ok_ = null;
        }

        var el = $(this.id);
        el.parentNode.removeChild(el);
    },
    create_interface: function(parent){
        //draw table, et cetera
        var root = Builder.node('div',{
            id: this.id,
            className: this.options.class_name
        });

        var table = Builder.node('table',{
            className: this.options.class_name,
            id: this.make_id('table')
        });

        var tbody = Builder.node('tbody');

        var trheader = Builder.node('tr',{
            className: 'header'
        });

        trheader.appendChild(Builder.node('td',{
            id: this.make_id('header_prev_month'),
            className: 'header_month_iterator'
        }));

        var tddate = trheader.appendChild(Builder.node('td',{
            colSpan: 5
        }));

        tddate.appendChild(Builder.node('span',{
            className:'header_month',
            id: this.make_id('header_month')
        }));

        tddate.appendChild(Builder.node('span',{
            className:'header_year',
            id: this.make_id('header_year')
        }));


        trheader.appendChild(Builder.node('td',{
            id: this.make_id('header_next_month'),
            className: 'header_month_iterator'
        }));

        tbody.appendChild(trheader);

        var trweekdays = Builder.node('tr',{
            className: 'weekdays'
        });

        var startday = this.options.week_starts_from;
        var lweekday = S.Calendar.lweekday_short;
        for(var i = startday;i<startday + 7;++i){
            var day_of_week = i%7;
            var cell = Builder.node('td',
                this.label(lweekday[day_of_week]));

            trweekdays.appendChild(cell);
        }

        tbody.appendChild(trweekdays);

        for(var i = 0; i<6; ++i){
            var tr = Builder.node('tr',{
                className: 'week'
            });

            for(var j = 0;j<7;++j){
                tr.appendChild(Builder.node('td',{id:this.make_id(i+'_'+j)}));
            }

            tbody.appendChild(tr);
        }

        if(this.options.time){
            var trtime = Builder.node('tr',{
                className:'time'
            });
            trtime.appendChild(Builder.node('td'));
            var tdtime = trtime.appendChild(Builder.node('td',{
                colSpan:5,
                className:'time'
            }));

            tdtime.appendChild(Builder.node('input',{
                id:this.make_id('hours'),
                value: '',
                type: 'text',
                maxLength:2
            }));

            tdtime.appendChild(Builder.node('span',':'));

            tdtime.appendChild(Builder.node('input',{
                id:this.make_id('minutes'),
                value: '',
                type: 'text',
                maxLength:2
            }));

            if(this.options.time_format == S.Calendar.AMPM){
                tdtime.appendChild(Builder.node('select',{
                    id:this.make_id('ampm')
                },[
                    Builder.node('option',{value:'am'},'am'),
                    Builder.node('option',{value:'pm'},'pm')
                ]));
            }

            var tdok = trtime.appendChild(Builder.node('td'));
            if(this.options.time){
                tdok.appendChild(Builder.node('a',{
                    id:this.make_id('on_ok'),
                    href:'javascript:void(0);'
                },'OK'));
            }

            tbody.appendChild(trtime);
        }

        table.appendChild(tbody);
        root.appendChild(table);
        parent.appendChild(root);

        //now attach various observers

        //next and prev months
        var nmonth = $(this.make_id('header_next_month'));
        nmonth.innerHTML = '&rarr;';

        var pmonth = $(this.make_id('header_prev_month'));
        pmonth.innerHTML = '&larr;';

        //watch mouse downs
        this.on_mousedown_ = this.on_mousedown.bindAsEventListener(this);
        this.on_mouseup_ = this.on_mouseup.bindAsEventListener(this);
        $(table).observe('mousedown',this.on_mousedown_);
        $(table).observe('mouseup',this.on_mouseup_);

        //validate hours and minutes
        if(this.options.time){
            this.on_hours_change_ = this.on_hours_change.bindAsEventListener(this);
            $(this.make_id('hours')).observe('change',this.on_hours_change_);
            this.on_minutes_change_ = this.on_minutes_change.bindAsEventListener(this);
            $(this.make_id('minutes')).observe('change',this.on_minutes_change_);
            this.on_ok_ = this.on_ok.bindAsEventListener(this);
            $(this.make_id('on_ok')).observe('click',this.on_ok_);
        }
        this.table = table;
    },
    render_date: function(date){
        var month = this.label(S.Calendar.lmonth_full[date.getMonth()]);
        this.el('header_month').innerHTML = month;
        var year = date.getFullYear();
        this.el('header_year').innerHTML = ''+year;

        var table = this.table;
        var dates = S.DateUtils.get_month_dates(date,this.options.week_starts_from);

        for(var i = 2; i< 8;++i)
        {
            for(var j = 0; j< 7; ++j){
                var celldate = dates[i-2][j];
                var cell = table.rows[i].cells[j];
                cell.innerHTML = celldate.getDate();
                this.options.decorator.decorate(this,date,cell,celldate);
            }
        }

        if(this.options.time){
            var hours = date.getHours();

            if(this.options.time_format == S.Calendar.AMPM){
                var ampm = S.DateConverter.hours24_to_ampm(hours);
                this.el('hours').value = ampm.hours;
                this.el('ampm').selectedIndex = ampm.ampm;
            }
            else{
                this.el('hours').value = hours;
            }

            this.el('minutes').value = this.padded_minutes(date.getMinutes());
        }

        return dates;
    },
    on_select_year: function(){
        var self = this;
        var original_year = this.date.getFullYear();
        var selected_year = original_year;
        var x = -123456;
        var span = document.getElementById(this.make_id('header_year'));
        var onmousemove = function(e){
            var nx = Event.pointerX(e);
            if(x == -123456){
                x = nx;
                return;
            }
            else{
                var diff = nx - x;
                if(Math.abs(diff) < 15){
                    return;
                }
                if(diff > 0){
                    selected_year+=1;
                }else{
                    selected_year-=1;
                }

                span.innerHTML = selected_year;
                x = nx;
            }
            //span.innerHTML = +':'+Event.pointerY(e);
        };
        Event.observe(document,'mousemove',onmousemove);
        var stopscroll = function(e){
            Event.stopObserving(document,'mousemove',onmousemove);
            Event.stopObserving(document,'mouseup',stopscroll);
            span.innerHTML = selected_year;
            var date = self.clone_date(self.date);
            date.setFullYear(selected_year);
            self.set_date(date);
            self.options.on_change(date);
        };

        Event.observe(document,'mouseup',stopscroll);
    },
    next_month: function(){
        var date = this.clone_date(this.date);
        date.setMonth(date.getMonth()+1);
        this.set_date(date);
        this.options.on_change(date);
    },
    prev_month: function(){
        var date = this.clone_date(this.date);
        date.setMonth(date.getMonth()-1);
        this.set_date(date);
        this.options.on_change(date);
    },
    get_cell: function(x,y){
        return this.table.rows[y+2].cells[x];
    },
    is_date_cell: function(el){
        if(el.tagName.toLowerCase() == 'td' &&
           el.parentNode.rowIndex > 1&& el.parentNode.rowIndex < 8)
            return true;
        return false;
    },
    on_mousedown: function(e){
        var el = Event.element(e);
        var tag = el.tagName.toLowerCase();
        if(tag == 'td'){
            if(el.className == 'header_month_iterator'){
                if(el.id == this.make_id('header_prev_month')){
                    this.mouse_action = 'prev_month';
                }
                else{
                    this.mouse_action = 'next_month';
                }
                Event.stop(e);
            }
            else if(this.is_date_cell(el)){
                Event.stop(e);
                if(this.options.time == false && this.options.region_select == true){
                    this.mouse_action = null;
                    this.on_select_region(el);
                }
                else{
                    this.mouse_action = 'select_date';
                    this.mouse_element = el;
                }
            }
        }
        else if(tag == 'span' && el.className == 'header_year'){
            Event.stop(e);
            this.on_select_year();
            this.mouse_action = null;
        }
        else{
            this.mouse_action = null;
        }
    },
    on_mouseup: function(e){
        if(this.mouse_action == 'prev_month'){
            this.prev_month();
        }
        else if(this.mouse_action == 'next_month'){
            this.next_month();
        }
        else if(this.mouse_action == 'select_date'){
            this.select_date(this.mouse_element);
        }

        this.mouse_action = null;
        this.mouse_element = null;
    },
    select_date: function(el){
        var ij = this.cell_to_coords(el);
        var celldate = this.dates[ij.y][ij.x];
        var date = this.clone_date(this.date);
        S.DateUtils.set_month_and_date(date,celldate.getMonth(),celldate.getDate());
        this.set_date(date);
        this.options.on_change(date);
        if('input' in this.options && this.options.time != true){
            this.options.input.value = this.formatter.to_string(date);
            this.hide();
            $(this.options.input).fire('ex:change');
        }
    },
    cell_to_coords: function(cell){
        return {
            y:cell.parentNode.rowIndex - 2,
            x:cell.cellIndex
        };
    },
    gt: function(s,e){
        return (s.x+s.y*7 > e.x+e.y*7);
    },
    minp: function(s,e){
        if(this.gt(s,e)){
            return e;
        }
        else{
            return s;
        }
    },
    maxp: function(s,e){
        if(this.gt(s,e)){
            return s;
        }
        else{
            return e;
        }
    },
    mark_region: function(s,e){
        this.options.decorator.mark_region(this,s,e);
    },
    on_select_region: function(el){
        var self = this;
        this.select_s = this.cell_to_coords(el);
        this.select_e = this.select_s;
        var t = null;
        this.options.decorator.mark_region(this,this.select_s,this.select_e);
        var s = this.select_s;
        var e = this.select_e;

        var onmousemove = function(e){
            var x = Event.pointerX(e);
            var y = Event.pointerY(e);
            if(Position.within(self.table,x,y)){
                for(var i = 2;i < 8;++i){
                    var row = self.table.rows[i];
                    if(Position.within(row,x,y)){
                        for(var j = 0;j<7;++j){
                            var cell = row.cells[j];
                            if(Position.within(cell,x,y)){
                                e = self.cell_to_coords(cell);
                                if(self.options.region_select_grab_week){
                                    if(s.y != e.y){
                                        if(self.gt(s,e)){
                                            e.x = 0;
                                            s.x = 6;
                                        }
                                        else{
                                            e.x = 6;
                                            s.x = 0;
                                        }
                                    }
                                }
                                self.options.decorator.mark_region(
                                    self,self.minp(s,e),self.maxp(s,e));
                                self.select_e = e;
                            }
                        }
                    }
                }
            }
        };
        Event.observe(document,'mousemove',onmousemove);
        var stopselect = function(event){
            Event.stopObserving(document,'mousemove',onmousemove);
            Event.stopObserving(document,'mouseup',stopselect);
            var a = self.minp(self.select_s,self.select_e);
            var b = self.maxp(self.select_s,self.select_e);
            self.options.on_region_select(
                self.dates[a.y][a.x],
                self.dates[b.y][b.x]);
        };

        Event.observe(document,'mouseup',stopselect);
    },
    on_ok: function(e){
        this.options.input.value = this.formatter.to_string(this.date);
        this.hide();
        $(this.options.input).fire('ex:change');
    },
    padded_minutes:function(value){
        if(value >= 0 && value < 10){
            return '0'+value;
        }
        return value;
    },
    on_hours_change: function(e){
        var el = this.el('hours');
        var hours = parseInt(el.value);
        if(isNaN(hours)){
            hours = 12;
        }

        if(this.options.time_format == S.Calendar.AMPM){
            if(hours > 12){
                hours = 12;
            }else if(hours < 1){
                hours = 1;
            }
            this.date.setHours(
                S.DateConverter.ampm_to_hours24(
                  hours,this.el('ampm').selectedIndex == 0?true:false));
        }
        else{
            if(hours > 23){
                hours = 23;
            }
            else if(hours < 0){
                hours = 0;
            }
            this.date.setHours(hours);
        }
        el.value = hours;
    },
    on_minutes_change: function(e){
        var el = this.el('minutes');
        var minutes = null;
        if(el.value[0] == 0){
            minutes = parseInt(el.value[1]);
        }
        else{
            minutes = parseInt(el.value);
        }

        if(isNaN(minutes) || minutes < 0){
            el.value = '00';
            minutes = 0;
        }
        else if(minutes > 59){
            el.value = '59';
            minutes = 59;
        }
        else{
            el.value = this.padded_minutes(minutes);
        }

        this.date.setMinutes(minutes);
    },
    on_document_mousedown: function(e){
        if(this.disabled == true){
            return;
        }

        this.document_mousedown_el = Event.element(e);
        var t = Event.findElement(e,'table');

        if(typeof(t) != 'undefined' && t.id == this.make_id('table')){
            this.document_mousedown_inside = true;
        }
        else{
            this.document_mousedown_inside = false;
        }
    },
    on_document_mouseup: function(e){
        if(this.disabled == true){
            return;
        }
        var el = this.document_mousedown_el;
        //if click was inside the calendar date cells, event will be stopped
        //inside the other handler, and we will not get document mousedown
        //and mousedown element would be null
        if(el == null){
            return;
        }
        var down_inside = this.document_mousedown_inside;
        this.document_mousedown_el = null;
        this.document_mousedown_inside = null;

        if(!this.div.visible()){
            var show = el.id == this.options.input.id;
            show = show || ('input' in this.options &&
                            'input_toggle' in this.options &&
                            el.id == this.options.input_toggle);
            if(show){
                this.set_date(this.formatter.from_string(this.options.input.value));
                this.position_calendar();
                this.show();
            }
        }
        else{
            if(!down_inside){
                if('input' in this.options){
                    this.set_date(
                        this.formatter.from_string(
                            this.options.input.value));
                }
                this.hide();
            }
        }
    },
    show: function(){
        this.div.show();
    },
    hide: function(){
        this.div.hide();
    },
    position_calendar:function(){
        var input = this.options.input;
        var input_offset = input.viewportOffset();
        var input_height = input.getHeight();
        var scroll_offset = document.viewport.getScrollOffsets();
        var viewport_height = document.viewport.getHeight();
        var div_height = this.div.getHeight();

        if(input_offset.top+input_height+div_height > viewport_height){
            var top = scroll_offset.top + input_offset.top - div_height;
            top = top<0?0:top;
            //position element above the input element
            this.div.setStyle({
                position: 'absolute',
                top: top+'px',
                left: scroll_offset.left + input_offset.left + 'px'
            });
        }
        else{
            this.div.setStyle({
                position: 'absolute',
                top: scroll_offset.top + input_offset.top + input_height + 'px',
                left: scroll_offset.left + input_offset.left + 'px'
            });
        }
    }
});

S.mixin(S.Calendar,S.IdBase);

S.Calendar.Decorator = Class.create({
    initialize: function(){

    },
    is_weekend: function(date){
        return date.getDay() == 0 || date.getDay() == 6;
    },
    decorate: function(control,date,cell,celldate){
        var is_weekend = this.is_weekend(celldate);
        if(celldate.getMonth() == date.getMonth()){
            if(celldate.getDate() == date.getDate()){
                cell.className = is_weekend?'this_month_date_weekend':'this_month_date';
            }
            else{
                cell.className = is_weekend?'this_month weekend':'this_month';
            }
        }
        else{
            cell.className = is_weekend?'other_month weekend':'other_month';
        }
    },
    mark_region: function(control,s,e){
        var sp = s.x+s.y*7;
        var ep = e.x+e.y*7;

        for(var y = 0; y< 6;++y){
            for(var x = 0; x< 7; ++x){
                var np = x+y*7;
                var cell = control.get_cell(x,y);
                if(np >= sp && np <= ep){
                    cell.className = 'region_date';
                }
                else{
                    this.decorate(control,control.date,cell,control.dates[y][x]);
                }
            }
        }
    }
});

Object.extend(S.Calendar,{
    //some constaints
    //days of week
    Mon:0, Tue:1, Wed: 2, Thu:3, Fri:4, Sat: 5, Sun: 6,
    //time format
    AMPM:0,H24:1,
    AM: 0,PM: 1,
    //labels
    lweekday_short: $w('Mon_s Tue_s Wed_s Thu_s Fri_s Sat_s Sun_s'),
    lweekday_mid: $w('Mon Tue Wed Thu Fri Sat Sun'),
    lweekday_full: $w('Monday Tuesday Wednesday Thursday Friday Saturday Sunday'),
    lmonth_full: $w('January February March April May June July August September October November December'),
    en: {
        'Mon_s': 'M',
        'Tue_s': 'T',
        'Wed_s': 'W',
        'Thu_s': 'T',
        'Fri_s': 'F',
        'Sat_s': 'S',
        'Sun_s': 'S'
    },
    translate_en: function(label){
        if(label in S.Calendar.en){
            return S.Calendar.en[label];
        }
        else{
            return label;   
        }
    }
});

S.translate = S.Calendar.translate_en;

})();