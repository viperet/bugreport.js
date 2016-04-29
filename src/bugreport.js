(function ( $, d ) {
    var settings,
    dragging = false,
    errors = [], // array to log JS errors
    overlay, panel
    bugreport = function ( options ) {
        settings = $.extend({
            // Defaults.
            zindex: 1000, // zindex of overlay, should be higher than anything on the screen
            overlay: "rgba(0,0,0,0.5)", // background color of overlay
            position: 'br', // position of bug report panel br = bottom right, (tr, br, bl, tl)
            url: null, // url to POST bug reports to
            data: {}, // additional data to send with bug report
        }, options );

        overlay = $('<div class="bugreport-overlay modal-backdrop"></div>')
            .css({
                'background-color': settings.overlay,
                'z-index': settings.zindex
            })
            .on('click', addNote)
            .on('click', '.bugreport-message .close', removeNote)
            .on('mousemove', dragNote)
            .on('mouseup', dragStop)
            .on('scroll wheel', function (e) { e.preventDefault(); e.stopPropagation(); })
            .appendTo(d.body);


        var position = {};
        switch(settings.position) {
            case 'tl': position = { top: 0, left: 0 }; break;
            case 'tr': position = { top: 0, right: 0 }; break;
            case 'bl': position = { bottom: 0, left: 0 }; break;
            case 'br': position = { bottom: 0, right: 0 }; break;
        }

        panel = $('<div class="bugreport-panel panel panel-danger"><div class="panel-heading"><button type="button" class="close" aria-label="Close"><span aria-hidden="true">×</span></button> Report bug</div><div class="panel-body">'+
            '<p>Click anywhere on page to add notes</p>'+
            '<div class="form-inline">'+
                '<div class="form-group"><button class="btn btn-info btn-xs" disabled><i class="glyphicon glyphicon-record"></i> Record voice notes</button></div> '+
                '<div class="form-group"><button class="bugreport-send btn btn-primary btn-xs"><i class="glyphicon glyphicon-send"></i> Send bug report</button></div>'+
            '</div>'+
            '</div></div>').css(position).appendTo(overlay);
        panel.find('.close').on('click', closeBugreport);
        panel.find('.bugreport-send').on('click', sendBugreport);
    };

    function closeBugreport() {
        $('.bugreport-overlay').remove();
    }

    function addNote(e) {
        if(!$(e.target).hasClass('bugreport-overlay')) return; // clicked not on overlay

        var note = $('<div class="bugreport-note"></div>');
        note.css({
            top: e.offsetY-10,
            left: e.offsetX-10
        }).appendTo(overlay);

        var message = $('<div class="bugreport-message panel panel-warning"><div class="panel-heading"><button type="button" class="close" aria-label="Close"><span aria-hidden="true">×</span></button><i class="glyphicon glyphicon-info-sign"></i> Bug Report note</div><div class="panel-body">'+
            '<textarea placeholder="Problem description here" class="form-control" rows="3"></textarea>'+
            '</div></div>').appendTo(note);

        var message_left = 50,
            message_top = 50,
            message_width = message.width(),
            message_height = message.height();

        if(e.offsetX + message_left + message_width > overlay.width()) message_left = -message_left - message_width;
        if(e.offsetY + message_top + message_height > overlay.height()) message_top = -message_top - message_height;

        var line = $('<div class="bugreport-line"></div>').prependTo(note);
        positionLine(line, message_left + (message_width>>1), message_top + (message_height>>1) );

        message.css({ top: message_top, left: message_left})
            .on('mousedown', function (e) {
                if($(e.target).hasClass('panel-heading')) {
                    dragging = $(this).closest('.bugreport-message');
                    dragging.point = note;
                    dragging.line = line;
                    dragging.position = note.position();
                    dragging.position.left += e.offsetX;
                    dragging.position.top += e.offsetY;
                    console.log(dragging);
                }
                console.log(e.target);
            });
    }

    function removeNote(e) {
        $(this).closest('.bugreport-note').remove();
    }

    function dragNote(e) {
        if(dragging) {
            var left =  e.clientX - dragging.position.left,
                top = e.clientY - dragging.position.top;

            dragging.css({
                left:left,
                top: top
            });

            var line_width = left + (dragging.width()>>1),
                line_height = top + (dragging.height()>>1);
            positionLine(dragging.line, line_width, line_height);
        }
    }

    function positionLine(line, line_width, line_height) {
            line.attr('class', 'bugreport-line');
            if(line_width > 0) {
                line.css({ width: line_width, left: 0, right: 'auto' }).addClass('bugreport-line-left');
            } else {
                line.css({ width: -line_width, left: 'auto', right: 0 }).addClass('bugreport-line-right');
            }
            if(line_height > 0) {
                line.css({ height: line_height, top: 0, bottom: 'auto' }).addClass('bugreport-line-bottom');
            } else {
                line.css({ height: -line_height, top: 'auto', bottom: 0 }).addClass('bugreport-line-top');
            }
    }

    function dragStop(e) {
        if(dragging) {
            dragging = false;
        }
    }

    function sendBugreport() {
        var notes = $.makeArray($('.bugreport-message textarea').map(function () { return $(this).val(); }));
        overlay.css('background-color', 'rgba(0,0,0,0)');
        panel.hide();
        html2canvas(d.body, {
            onrendered: function(canvas) {
                overlay.hide();
                if(typeof settings.data == 'function') {
                    settings.data = settings.data.call(d);
                }
                data = $.extend({
                    datetime: Date(),
                    image: canvas.toDataURL("image/png"),
                    userAgent: navigator.userAgent,
                    url: document.location.href,
                    errors: errors,
                    notes: notes

                }, settings.data);

                var modal = message('Sending', '<h4>Sending your bug report...<br>Please wait</h4>')
                    .addClass('bugreport-send-modal')
                    .find('.close, .modal-footer').remove().end();
                modal.on('shown.bs.modal', function () {

                    if(typeof settings.url == 'string') {
                        // url is a string, POST bugreport to that url
                        $.ajax({
                            url: settings.url,
                            method: 'POST',
                            dataType: 'text',
                            contentType: 'application/json; charset=UTF-8',
                            data: JSON.stringify(data)
                        })
                        .done(bugreportSent)
                        .error(bugreportError);

                    } else if( typeof settings.url == 'function' ) {
                        // url is a function, call it with our bug report data as parameter
                        $.when(settings.url.call(d, data)).then(bugreportSent, bugreportError);
                    } else {
                        // no valid url give,just show bug report data to user (demo mode)
                        // not done yet
                    }
                });
            }
        });
    }

    function bugreportSent(response) {
        overlay.remove();
        $('.bugreport-send-modal, .modal-backdrop:not(.bugreport-overlay)').remove();
        message('Done', '<h3>Your bug report successfully sent <br>' + (response || '') + '</h3>');
    }
    function bugreportError(response) {
        $('.bugreport-send-modal, .modal-backdrop:not(.bugreport-overlay)').remove();
        message('Error', '<h4>There is error sending your bug report: <br>' + (response || 'Please try again') + '</h4>')
		.on('hidden.bs.modal', function (e) {
            overlay.show().css('background-color', settings.overlay);
            panel.show();
		});
    }

    function setErrorLogger() {
        window.onerror = function (msg, url, lineNo, columnNo, error) {
            errors.push({
                type: 'error',
                msg: msg,
                url: url,
                line: lineNo,
                col: columnNo || '',
                stack: (typeof error != 'undefined'? error.stack || '' : '')
            })
            return false;
        }
    }

    // captures error
    function logError(error) {
        errors.push({
            type: 'exception',
            msg: error.message,
            url: error.fileName,
            line: error.lineNumber,
            col: '',
            stack: error.stack || ''
        });
    }

    // log message
    function logMessage(message, data) {
        var err = new Error();
        errors.push({
            type: 'log',
            msg: message,
            url: '',
            line: '',
            col: '',
            stack: err.stack || '',
            data: data
        });
    }

    function message(title, message) {
		return $('<div class="modal fade" id="errormodal" data-keyboard="false" data-backdrop="static"><div class="modal-dialog"><div class="modal-content">'+
'<div class="modal-header"><button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>'+
'<h4 class="modal-title"></h4></div><div class="modal-body"></div><div class="modal-footer">'+
'<button type="button" class="btn btn-sm btn-white btn-ok" data-dismiss="modal" aria-hidden="true">OK</button>'+
'</div></div></div></div>')
			.clone().appendTo('body')
			.removeAttr('id')
			.find('.modal-title').html(title).end()
			.find('.modal-body').html(message).end()
			.modal()
			.on('shown.bs.modal', function (e) {
				$(this).find('input:first').focus();
			})
			.on('hidden.bs.modal', function (e) {
				$(this).remove();
			});
    }

    $.fn.bugreport = function( options ) {
        return this.each(function() {
            $(this).on('click', function () { bugreport(options); });
        });
    };

    $.bugreport = bugreport;
    $.bugreport.close = closeBugreport;
    $.bugreport.error = logError;
    $.bugreport.log = logMessage;

    setErrorLogger();

}( jQuery, document ));