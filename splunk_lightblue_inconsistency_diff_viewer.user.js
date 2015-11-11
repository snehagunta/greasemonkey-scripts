// ==UserScript==
// @name        splunk_lightblue_inconsistency_diff_viewer
// @description Splunk lightblue inconsistency diff viewer. It is using jsdifflib library (https://github.com/cemerick/jsdifflib).
// @version     0.3
// @namespace   _splunk_lightblue
// @include     https://splunk.corp.redhat.com/*
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js
// @require     http://ajax.googleapis.com/ajax/libs/jqueryui/1.8/jquery-ui.min.js
// @require     http://cemerick.github.io/jsdifflib/difflib.js
// @require     http://cemerick.github.io/jsdifflib/diffview.js
// @resource    jqUI_CSS  http://ajax.googleapis.com/ajax/libs/jqueryui/1.8/themes/base/jquery-ui.css
// @resource    diffView_CSS  http://cemerick.github.io/jsdifflib/diffview.css
// @resource    IconSet1  http://ajax.googleapis.com/ajax/libs/jqueryui/1.8/themes/base/images/ui-icons_222222_256x240.png
// @resource    IconSet2  http://ajax.googleapis.com/ajax/libs/jqueryui/1.8/themes/base/images/ui-icons_454545_256x240.png
// @grant       GM_addStyle
// @grant       GM_getResourceText
// @grant       GM_getResourceURL
// @updateURL   https://raw.githubusercontent.com/ykoer/greasemonkey-scripts/master/splunk_lightblue_inconsistency_diff_viewer.user.js
// @downloadURL https://raw.githubusercontent.com/ykoer/greasemonkey-scripts/master/splunk_lightblue_inconsistency_diff_viewer.user.js
// ==/UserScript==

//--- Add our custom dialog using jQuery. Note the multi-line string syntax.
$("body").append (
    '<div id="gmOverlayDialog"></div>'
);

var iconSet1        = GM_getResourceURL ("IconSet1");
var iconSet2        = GM_getResourceURL ("IconSet2");
var jqUI_CssSrc     = GM_getResourceText ("jqUI_CSS");
var diffView_CssSrc = GM_getResourceText ("diffView_CSS");
jqUI_CssSrc         = jqUI_CssSrc.replace (/url\(images\/ui\-bg_.*00\.png\)/g, "");
jqUI_CssSrc         = jqUI_CssSrc.replace (/images\/ui-icons_222222_256x240\.png/g, iconSet1);
jqUI_CssSrc         = jqUI_CssSrc.replace (/images\/ui-icons_454545_256x240\.png/g, iconSet2);

GM_addStyle (jqUI_CssSrc);
GM_addStyle (diffView_CssSrc);


function main() {

    var map = {
        'getEngineeringProductsForSkus': 'sortEngineeringProduct2Dim',
        'getEngineeringProductsByOID': 'sortEngineeringProduct1Dim',
        'getProducts': 'sortOperationalProduct1Dim',
    } 

    function parseLog(log) {
        i1 = log.indexOf('Inconsistency found in ')+23;
        i2 = log.indexOf('(',i1);
        i3 = log.indexOf(':',i2);
        i4 = log.indexOf('legacyJson: ',i3);
        i5 = log.indexOf(', lightblueJson: ',i4);

        var api = log.substring(i1,i3);
        var methodName = log.substring(i1,i2);
        var legacyJson = log.substring(i4+12,i5);
        var lightblueJson = log.substring(i5+17);

        json1 = sortJson(legacyJson, methodName);
        json2 = sortJson(lightblueJson, methodName);

        showDiffWidget(json1, json2);
    }

    function sortJson(jsonString, method) {
        var json = JSON.parse(jsonString);

        switch (method) {
            case 'getEngineeringProductsForSkus': return sortEngineeringProduct2Dim(json);
            case 'getEngineeringProductsByOID': sortEngineeringProduct1Dim(json);
            case 'getProducts': return sortOperationalProduct1Dim(json);
        }
        return json;
    }

    function sortEngineeringProduct2Dim(json) {
        for(i=0; i<json.length; i++) {
            json[i].sort( predicateBy("oid") );
            for(j=0; j<json[i].length; j++) {
                if (json[i][j].attributes != null) {
                    json[i][j].attributes.sort( predicateBy("code") );
                }
                if (json[i][j].content != null) {
                    json[i][j].content.sort( predicateBy("oid") );
                    for(k=0; k<json[i][j].content.length; k++) {
                        if (json[i][j].content[k].attribute != null) {
                            json[i][j].content[k].attribute.sort( predicateBy("code") );
                        }
                    }
                }
            }
        }
        return json;
    }

    function sortEngineeringProduct1Dim(json) {
        if (json != null) {
            json.sort( predicateBy("oid") );
            for(i=0; i<json.length; i++) {
                if (json[i].attributes != null) {
                    json[i].attributes.sort( predicateBy("code") );
                }
                if (json[i].content != null) {
                    json[i].content.sort( predicateBy("oid") );
                    for(j=0; j<json[i].content.length; j++) {
                        if (json[i].content[j].attribute != null) {
                            json[i].content[j].attribute.sort( predicateBy("code") );
                        }
                    }
                }
            }
        }
        return json;
    }

    function sortOperationalProduct1Dim(json) {
        for(i=0; i<json.length; i++) {
            if (json[i].attributes != null) {
                json[i].attributes.sort( predicateBy("code") );
            }
        }
        return json;
    }

    function predicateBy(prop){
        return function(a,b){
            if( a[prop] > b[prop]){
                return 1;
            } else if( a[prop] < b[prop] ){
                return -1;
            }
            return 0;
        }
    }
    
    function draw_buttons () {
        var items = $('tr.shared-eventsviewer-list-body-row');
        items.each(function (index, el_tmp) {

            if ($(el_tmp).find('td._time button').length === 0) {
                var log = $(el_tmp).find('td._time').parentsUntil('tbody').last().find('div.raw-event').text();

                if(log.indexOf('Inconsistency found in')>0) {
                    var el = $(el_tmp).find('td._time'),
                        container,
                        format_button = $('<button>');
                    format_button.text('Inconsistency Diff');
                    format_button.addClass('json-splunk splIconicButton splButton-tertiary');
                    format_button.on('click', function() {
                        parseLog(log);
                    });
                    el.append(format_button);
                }

            }
        });
    }
    
    function showDiffWidget(json1, json2) {
        
        createDiff(json1, json2);
        var w = $(window).width();
        var h = $(window).height();
        
        $("#gmOverlayDialog").dialog ( {
            modal:      true,
            title:      "Inconsistency Diff",
            width:      1200,
            height:     700,
            zIndex:     83666   //-- This number doesn't need to get any higher.
        });
        
        $("html, body").animate({ scrollTop: 0 }, "fast");
    }
    
    function createDiff(json1, json2) {

        var legacy = difflib.stringAsLines(JSON.stringify(json1, null, 3));
        var lightblue = difflib.stringAsLines(JSON.stringify(json2, null, 3));
        var sm = new difflib.SequenceMatcher(legacy, lightblue);
        var opcodes = sm.get_opcodes();
        var diffoutputdiv = $("#gmOverlayDialog");
        var contextSize = "";


        diffoutputdiv.innerHTML = "";
        contextSize = contextSize || null;

        diffoutputdiv.append(diffview.buildView({
            baseTextLines: legacy,
            newTextLines: lightblue,
            opcodes: opcodes,
            baseTextName: "Legacy response",
            newTextName: "Lightblue response",
            contextSize: contextSize,
            viewType: 0
        }));
    }

    // Try to draw the buttons every 1000ms.  Previously, this was done by
    // creating a Splunk.Module.EventsViewer.prototype.onResultsRendered
    // function, but Splunk.Module is no longer defined in Splunk 6.1.4,
    // even though docs imply that it should be.  Not sure why the previous
    // approach no longer works, but this hacky interval will do until I
    // can figure out how to wire up the event again.
    setInterval(function() {
        draw_buttons();
    }.bind(this), 1000);
}

main();
