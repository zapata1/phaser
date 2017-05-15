var GetValue = require('../utils/object/GetValue');
var GetEaseFunction = require('./GetEaseFunction');
var CloneObject = require('../utils/object/Clone');
var MergeRight = require('../utils/object/MergeRight');

// var RESERVED = [ 'targets', 'ease', 'duration', 'yoyo', 'repeat', 'loop', 'paused', 'useFrames', 'offset' ];

/*
    The following are all the same

    var tween = this.tweens.add({
        targets: player,
        x: 200,
        duration: 2000,
        ease: 'Power1',
        yoyo: true
    });

    var tween = this.tweens.add({
        targets: player,
        props: {
            x: 200
        }
        duration: 2000,
        ease: 'Power1',
        yoyo: true
    });

    var tween = this.tweens.add({
        targets: player,
        x: { value: 200, duration: 2000, ease: 'Power1', yoyo: true }
    });

    var tween = this.tweens.add({
        targets: player,
        props: {
            x: { value: 200, duration: 2000, ease: 'Power1', yoyo: true }
        }
    });

    //  Chained property tweens:
    //  Each tween uses the same duration and ease because they've been 'globally' defined, except the middle one,
    //  which uses its own duration as it overrides the global one

    var tween = this.tweens.add({
        targets: player,
        x: [ { value: 200 }, { value: 300, duration: 50 }, { value: 400 } ],
        duration: 2000,
        ease: 'Power1',
        yoyo: true
    });

    //  Multiple property tweens:

    var tween = this.tweens.add({
        targets: player,
        x: { value: 400, duration: 2000, ease: 'Power1' },
        y: { value: 300, duration: 1000, ease: 'Sine' }
    });

    var tween = this.tweens.add({
        targets: player,
        props: {
            x: { value: 400, duration: 2000, ease: 'Power1' },
            y: { value: 300, duration: 1000, ease: 'Sine' }
        }
    });

    //  Multiple Targets + Multiple property tweens:

    var tween = this.tweens.add({
        targets: [ alien1, alien2, alien3, alienBoss ],
        props: {
            x: { value: 400, duration: 2000 },
            y: { value: 300, duration: 1000 }
        },
        ease: 'Sine'
    });

    //  Multiple Targets + Multiple properties + Multi-state Property tweens:

    var tween = this.tweens.add({
        targets: [ alien1, alien2, alien3, alienBoss ],
        props: {
            x: [ { value: 200, duration: 100 }, { value: 300, duration: 50 }, { value: 400 } ],
            y: { value: 300, duration: 1000 }
        },
        ease: 'Sine'
    });

    //  Multi-value Tween Property with static values

    var tween = this.tweens.add({
        targets: [ alien1, alien2, alien3, alienBoss ],
        props: {
            x: [ 200, 300, 400 ],
            y: [ '+100', '-100', '+100' ]
        },
        duration: 1000,
        ease: 'Sine'
    });
    
    //  Timeline concept

    var tween = this.tweens.add({
        targets: player,
        timeline: [
            { x: 400 },
            { y: 400 },
            { x: 100 },
            { y: 100 }
        ],
        duration: 1000,
        ease: 'Sine'
    });

 */

var Tween = function (manager, config)
{
    this.manager = manager;

    this.config = config;

    //  The following config properties are reserved words, i.e. they map to Tween related functions
    //  and properties. However if you've got a target that has a property that matches one of the
    //  reserved words, i.e. Target.duration - that you want to tween, then pass it inside a property
    //  called `props`. If present it will use the contents of the `props` object instead.
    //  If you have a Target property you want to tween called 'props' then you're SOL I'm afraid!

    //  Array of Targets

    //  [
    //      {
    //          target: targetRef,
    //          props: {
    //              x: {
    //                  start: 0,
    //                  current: 0,
    //                  end: 0
    //              },
    //              y: {
    //                  start: 0,
    //                  current: 0,
    //                  end: 0
    //              }
    //          }
    //      }
    //  ]

    this.targets = [];

    this.props = [];

    //  One of these for every property being tweened
    this.defaultTweenProp = {
        key: '',
        value: null,    // target value (as defined in the original tween, could be a number, string or function)
        current: 0,     // index of which TweenData in the queue it's currently running
        queue: []       // array of TweenData objects (always at least 1, but can be more)
    };

    //  Keep start and end values to ensure we never go over them when ending
    this.defaultTargetProp = {
        start: 0,
        current: 0,
        end: 0
    };

    //  'Default' Tween properties, duplicated for each property
    //  Swap for local getValue for speed
    //  TODO: Add local getters (getLoop, getProgress, etc)

    this.defaultTweenData = {
        ease: GetEaseFunction(GetValue(config, 'ease', 'Power0')),
        duration: GetValue(config, 'duration', 1000),
        yoyo: GetValue(config, 'yoyo', false),
        repeat: GetValue(config, 'repeat', 0),
        loop: GetValue(config, 'loop', false),
        delay: GetValue(config, 'delay', 0),
        startAt: null,
        progress: 0,
        startTime: 0,
        elapsed: 0,
        direction: 0 // 0 = forward, 1 = reverse
    };
 
 
    //  Only applied if this Tween is part of a Timeline
    // this.offset = GetValue(config, 'offset', 0);

    // this.onCompleteDelay = GetValue(config, 'onCompleteDelay', 0);
    //  Same as repeat -1 (if set, overrides repeat value)
    // this.loop = GetValue(config, 'loop', (this.repeat === -1));

    this.useFrames = GetValue(config, 'useFrames', false);

    //  These both do the same thing - pick the most suitable
    this.autoStart = GetValue(config, 'autoStart', true);
    // this.paused = GetValue(config, 'paused', false);

    this._hasInit = false;

    //  Callbacks

    this.onStart;
    this.onStartScope;
    this.onStartParams;

    this.onUpdate;
    this.onUpdateScope;
    this.onUpdateParams;

    this.onRepeat;
    this.onRepeatScope;
    this.onRepeatParams;

    this.onComplete;
    this.onCompleteScope;
    this.onCompleteParams;

    this.callbackScope;

    //  Running properties

    // this.running = this.autoStart;
    // this.progress = 0;
    // this.totalDuration = 0;

    // this.build(config);
};

Tween.prototype.constructor = Tween;

Tween.prototype = {

    //  Build Process:

    //  For Each Prop
    //      Create TweenProp object
    //      Populate queue with TweenData objects (at least 1)
    //      Add to props array
    //  For Each Target
    //      Create Target object
    //      For Each Prop
    //          Create TargetProp object in props object

    init: function (timestamp, delta)
    {
        var config = this.config;

        //  For now let's just assume only `config.props` is being used:

        var propKeys = [];

        //  Build the props array
        for (var key in config.props)
        {
            var prop = CloneObject(this.defaultTweenProp);

            prop.key = key;
            prop.value = config.props[key];

            this.props.push(prop);

            propKeys.push(key);
        }

        //  Build the targets array
        var targets = this.getTargets(config);

        for (var i = 0; i < targets.length; i++)
        {
            var target = {
                ref: targets[i],
                props: {}
            };

            for (var k = 0; k < propKeys.length; k++)
            {
                target.props[propKeys[k]] = CloneObject(this.defaultTargetProp);
            }

            this.targets.push(target);
        }

        if (this.autoStart)
        {
            this.buildTweenData(timestamp, delta);
        }
    },

    //  Called when the Tween first starts (moves from 'pending' to 'active')

    buildTweenData: function (timestamp, delta)
    {
        var config = this.config;

        //  Loop through the properties and populate the Target values

    },

    /*
    startTween: function ()
    {
            var data;
            var value = config.props[key];

            if (typeof value === 'number')
            {
                // props: {
                //     x: 400,
                //     y: 300
                // }
                data = CloneObject(this.defaultTweenData);

                prop.value = parseFloat(value);
            }
            else if (typeof value === 'string')
            {
                // props: {
                //     x: '+400',
                //     y: '-300'
                // }
            }
            else if (typeof value === 'function')
            {
                // props: {
                //     x: function () { return Math.random() * 10 },
                //     y: someOtherCallback
                // }
                data = CloneObject(this.defaultTweenData);

                //  Technically this could return a number, string or object
                prop.value = parseFloat(value.call());
            }
            else
            {
                // props: {
                //     x: { value: 400, ... },
                //     y: { value: 300, ... }
                // }

                data = MergeRight(this.defaultTweenData, value);

                //  Value may still be a string, function or a number

                prop.value = parseFloat(data.value);
            }

    },
    */

    // getPropValue

    //  Move to own functions

    getV: function (obj, key)
    {
        if (obj.hasOwnProperty(key))
        {
            return obj[key];
        }
        else if (this[key])
        {
            return this[key];
        }
    },

    /*
    buildTweenData: function (config)
    {
        //  For now let's just assume `config.props` is being used:

        // props: {
        //     x: 400,
        //     y: 300
        // }

        // props: {
        //     x: { value: 400, duration: 2000, ease: 'Power1' },
        //     y: { value: 300, duration: 1000, ease: 'Sine' }
        // }

        for (var key in config.props)
        {
            //  Check it's not a string or number (or function?)
            //  TODO: value might be an Array

            var data;
            var value = config.props[key];

            if (typeof value === 'number')
            {
                data = CloneObject(this.defaultTweenData);

                data.value = value;
            }
            else if (typeof value === 'string')
            {
                //  Do something :)
            }
            else
            {
                data = MergeRight(this.defaultTweenData, config.props[key]);
            }

            //  this.props = [
            //      {
            //          key: 'x',
            //          running: true,
            //          complete: false,
            //          current: 0,
            //          queue: [ TweenData, TweenData, TweenData ],
            //          totalDuration: Number (ms)
            //      }
            //  ]

            //  Convert to ms
            data.duration *= 1000;

            var propertyMarker = CloneObject(this.defaultInstance);

            propertyMarker.key = key;

            //  Adapt these to support array based multi-inserts
            propertyMarker.queue.push(data);
            propertyMarker.totalDuration = data.duration;

            this.props.push(propertyMarker);

            this.totalDuration += propertyMarker.totalDuration;
        }
    },
    */

    //  Update Loop:

    //  For Each Prop
    //      Get current TweenData
    //      Update elapsed time
    //      Get ease value
    //      For Each Target
    //          Apply ease value to Target value
    //      Has the tween finished?
    //          No: Wait for next update
    //          Yes: Advance queue index, or complete tween

    update: function (timestep, delta)
    {
    },

    OLDupdate: function (timestep, delta)
    {
        if (!this.running)
        {
            return;
        }

        //  Calculate tweens

        var list = this.props;
        var targets = this.targets;

        //  this.props = [
        //      {
        //          key: 'x',
        //          start: [ Target0 startValue, Target1 startValue, Target2 startValue ],
        //          end: [ Target0 endValue, Target1 endValue, Target2 endValue ],
        //          running: true,
        //          complete: false,
        //          current: 0,
        //          queue: [ TweenData, TweenData, TweenData ],
        //          totalDuration: Number (ms)
        //      }
        //  ]

        for (var i = 0; i < list.length; i++)
        {
            var entry = list[i];

            //  Update TweenData

            if (entry.running)
            {
                // TweenData = {
                //     value: undefined,
                //     progress: 0,
                //     startTime: 0,
                //     ease: this.ease,
                //     duration: this.duration,
                //     yoyo: this.yoyo,
                //     repeat: this.repeat,
                //     loop: this.loop,
                //     delay: this.delay,
                //     startAt: undefined,
                //     elapsed: 0
                // };

                var tweenData = entry.queue[entry.current];

                tweenData.elapsed += delta;

                if (tweenData.elapsed > tweenData.duration)
                {
                    tweenData.elapsed = tweenData.duration;
                }

                //  What % is that?
                tweenData.progress = tweenData.elapsed / tweenData.duration;

                for (var t = 0; t < targets.length; t++)
                {
                    targets[i][entry.key] = tweenData.value;
                }
            }
        }

    },

    getTargets: function (config)
    {
        var targets = GetValue(config, 'targets', null);

        if (typeof targets === 'function')
        {
            targets = targets.call();
        }

        if (!Array.isArray(targets))
        {
            targets = [ targets ];
        }

        return targets;
    },

    eventCallback: function (type, callback, params, scope)
    {
        var types = [ 'onStart', 'onUpdate', 'onRepeat', 'onComplete' ];

        if (types.indexOf(type) !== -1)
        {
            this[type] = callback;
            this[type + 'Params'] = params;
            this[type + 'Scope'] = scope;
        }

        return this;
    },

    timeScale: function ()
    {

    }

};

module.exports = Tween;
