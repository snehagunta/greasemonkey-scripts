// ==UserScript==
// @name        splunk_lightblue_inconsistency_diff_viewer
// @description Splunk lightblue inconsistency diff viewer. It is using jsdifflib library (https://github.com/cemerick/jsdifflib).
// @version     0.4
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

//--- Add the diff dialog window using jQuery. Note the multi-line string syntax.
$("body").append (
    '<div id="gmOverlayDialog"> \
        <div class="top"> \
            <ul><li style="list-style:none;"> \
                Context size (optional):<input type="text" id="contextSize" value="" style="width: 50px;"/>&nbsp; \
                <input type="radio" name="_viewtype" id="sidebyside"/ value="0" checked>Side by Side Diff&nbsp; \
                <input type="radio" name="_viewtype" id="inline" value="1"/>inline&nbsp; \
                <button class="json-splunk splIconicButton splButton-tertiary" id="applyViewTypeChange">Apply</button> \
            </li></ul> \
        </div> \
        <div id="diffoutput"></div> \
    </div>'
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
GM_addStyle (".li {display:inline}");


function main() {

    // register events
    $("#applyViewTypeChange").click(function () {
        createDiff();
    });

    function createDiff() {
        var contextSize = $("#contextSize").val() || null;
        var type = parseInt($('input[name=_viewtype]:checked').val());
        var legacy = difflib.stringAsLines(JSON.stringify(legacyJson, null, 3));
        var lightblue = difflib.stringAsLines(JSON.stringify(lightblueJson, null, 3));
        var sm = new difflib.SequenceMatcher(legacy, lightblue);
        var opcodes = sm.get_opcodes();
        var diffoutputdiv = $("#diffoutput");

        diffoutputdiv.empty();
        diffoutputdiv.append(diffview.buildView({
            baseTextLines: legacy,
            newTextLines: lightblue,
            opcodes: opcodes,
            baseTextName: "Legacy response",
            newTextName: "Lightblue response",
            contextSize: contextSize,
            viewType: type
        }));
    }

    function showDiffWidget() {
        createDiff();
        $("#gmOverlayDialog").dialog("open");
    }

    function initDiffWidget() {
        $("#gmOverlayDialog").dialog ( {
            modal:      true,
            autoOpen:   false,
            title:      "Inconsistency Diff",
            width:      1200,
            height:     700,
            zIndex:     83666,   //-- This number doesn't need to get any higher.
            open: function () {
                $(this).scrollTop(0);
            }
        });
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
                    format_button.on('click', function() {
                        parseLog(log);
                    });
                    el.append(format_button);
                }

            }
        });
    }

    function parseLog(log) {
        i1 = log.indexOf('Inconsistency found in ')+23;
        i2 = log.indexOf('(',i1);
        i3 = log.indexOf(':',i2);
        i4 = log.indexOf('legacyJson: ',i3);
        i5 = log.indexOf(', lightblueJson: ',i4);

        if(i4>0 && i5>0) {

            var api = log.substring(i1,i3);
            var methodName = log.substring(i1,i2);
            var legacyJsonLog = log.substring(i4+12,i5);
            var lightblueJsonLog = log.substring(i5+17);

            legacyJson = sortJson(legacyJsonLog, methodName);
            lightblueJson = sortJson(lightblueJsonLog, methodName);

            showDiffWidget();
        } else {
            alert("Can not show the diff since the json payload is too long!");
        }
    }

    function sortJson(jsonString, method) {
        var json = JSON.parse(jsonString);
        switch (method) {
            case 'getEngineeringProductsForSkus': return sortEngineeringProduct2Dim(json);
            case 'getEngineeringProductsByOID': sortEngineeringProduct1Dim(json);
            case 'getProducts': return sortOperationalProduct1Dim(json);
            case 'SubscriptionServiceFacade.getSubscriptionsDetails': return sortGetSubscriptionsDetails(json);
            case 'SubscriptionServiceFacade.getSubscriptionsPaging': return sortGetSubscriptionsPaging(json);
            case 'SubscriptionServiceFacade.getNestedSubscriptionsDetails': return sortNestedSubscriptionsDetails(json);
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

    function sortOperationalProduct1Dim(json) {
        for(i=0; i<json.length; i++) {
            if (json[i].attributes != null) {
                json[i].attributes.sort( predicateBy("code") );
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

    function sortGetSubscriptionsDetails(json) {
        if (json != null) {
            json.sort(sortByKey("sku"));
            for(i=0; i<json.length; i++) {
                json[i].entries.sort(predicateBy("key"));
            }
        }
        return json;
    }

    function sortGetSubscriptionsPaging(json) {
        if (json != null) {
            json.sort(predicateBy("id"));
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


    function sortNestedSubscriptionsDetails(json) {
       json.sort(sortByKey("id"));
       for(j=0; j<json.length; j++) {
           json[j].nested.sort(sortByKey("sku"));
           for(k=0; k<json[j].nested.length; k++) {
               json[j].nested[k].entries.sort(predicateBy("key"));
           }
       }
       return json;

    }

    function sortByKey(key) {
        return function(a, b) {
            var val1 = "";
            for(i=0; i<a.entries.length; i++) {
                if (a.entries[i].key==key) {
                    val1=a.entries[i].value;
                    break;
                }
            }

            var val2 = "";
            for(i=0; i<b.entries.length; i++) {
                if (b.entries[i].key==key) {
                    val2=b.entries[i].value;
                    break;
                }
            }
            return val1 < val2;
        }
    }


    // Try to draw the buttons every 1000ms.  Previously, this was done by
    // creating a Splunk.Module.EventsViewer.prototype.onResultsRendered
    // function, but Splunk.Module is no longer defined in Splunk 6.1.4,
    // even though docs imply that it should be.  Not sure why the previous
    // approach no longer works, but this hacky interval will do until I
    // can figure out how to wire up the event again.
    setInterval(function() {
        initDiffWidget();
        draw_buttons();
    }.bind(this), 3000);


}

main();
