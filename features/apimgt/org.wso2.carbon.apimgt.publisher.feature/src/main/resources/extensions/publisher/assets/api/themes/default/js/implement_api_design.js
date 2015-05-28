var APIMangerAPI = {};
$(function () {

//This is the default place holder
    var api_doc =
    {
        "apiVersion": "",
        "swaggerVersion": "1.2",
        "apis": [],
        "info": {
            "title": "",
            "description": "",
            "termsOfServiceUrl": "",
            "contact": "",
            "license": "",
            "licenseUrl": ""
        },
        "authorizations": {
            "oauth2": {
                "type": "oauth2",
                "scopes": []
            }
        }
    };


    Handlebars.registerHelper('setIndex', function (value) {
        this.index = Number(value);
    });

    Handlebars.registerHelper('console_log', function (value) {
        console.log(value);
    });

    Handlebars.registerHelper('toString', function returnToString(x) {
        return ( x === void 0 ) ? 'undefined' : x.toString();
    });

    var content_types = [
        {value: "application/json", text: "application/json"},
        {value: "application/xml", text: "application/xml"},
        {value: "text/plain", text: "text/plain"},
        {value: "text/html", text: "text/html"}
    ];

//Create a designer class
    function APIDesigner() {
        //implement singleton pattern
        this.baseURLValue = "";

        if (arguments.callee._singletonInstance) {
            return arguments.callee._singletonInstance;
        }
        arguments.callee._singletonInstance = this;

        this.api_doc = {};
        this.resources = [];

        this.container = $("#api_designer");

        //initialise the partials
        //source   = $("#designer-resources-template").html();
        //Handlebars.partials['designer-resources-template'] = Handlebars.compile(source);
        //source   = $("#designer-resource-template").html();
        // Handlebars.partials['designer-resource-template'] = Handlebars.compile(source);
        //if($('#scopes-template').length){
        //    source   = $("#scopes-template").html();
        //   Handlebars.partials['scopes-template'] = Handlebars.compile(source);
        //}

        this.init_controllers();

        $("#api_designer").delegate(".resource_expand", "click", this, function (event) {
            if (this.resource_created == undefined) {
                event.data.render_resource($(this).parent().next().find('.resource_body'));
                this.resource_created = true;
                $(this).parent().next().find('.resource_body').show();
            }
            else {
                $(this).parent().next().find('.resource_body').toggle();
            }
        });

        $("#api_designer").delegate("#add_resource", "click", this, function (event) {
            var designer = APIDesigner();
            if ($("#resource_url_pattern").val() == "" || $('#inputResource').val() == "") {
                BootstrapDialog.alert("URL pattern & Resource cannot be empty.");
                return;
            }
            var path = $("#resource_url_pattern").val();
            if (path.charAt(0) != "/") {
                path = "/" + path;
            }

            var resource_exist = false;
            $(".http_verb_select").each(function () {    //added this validation to fix https://wso2.org/jira/browse/APIMANAGER-2671
                if ($(this).is(':checked')) {
                    if (designer.check_if_resource_exist(path, $(this).val())) {
                        resource_exist = true;
                        var err_message = "Resource already exist for URL Pattern " + path + " and Verb " + $(this).val();
                        BootstrapDialog.alert(err_message);
                        return;
                    }
                }
            });
            if (resource_exist) {
                return;
            }

            var resource = {
                path: path
            };
            //create parameters
            var re = /\{[a-zA-Z0-9_-]*\}/g;
            var parameters = [];

            /*parameters.push({
             "name": "Authorization",
             "description": "Access Token",
             "paramType": "header",
             "required": true,
             "allowMultiple": false,
             "dataType": "String"
             });*/ // Authorization will be set globaly in swagger console.

            while ((m = re.exec($("#resource_url_pattern").val())) != null) {
                if (m.index === re.lastIndex) {
                    re.lastIndex++;
                }
                parameters.push({
                                    name: m[0].replace("{", "").replace("}", ""),
                                    "paramType": "path",
                                    "allowMultiple": false,
                                    "required": true,
                                    "type": "string"
                                })
            }

            resource.operations = [];
            var vc = 0;
            var ic = 0;
            $(".http_verb_select").each(function () {
                if ($(this).is(':checked')) {
                    if (!designer.check_if_resource_exist(path, $(this).val())) {
                        parameters = $.extend(true, [], parameters);

                        var method = $(this).val();
                        var tempPara = parameters.concat();

                        if (method == "POST" || method == "PUT") {
                            tempPara.push({
                                              name: "body",
                                              "description": "Request Body",
                                              "allowMultiple": false,
                                              "required": false,
                                              "paramType": "body",
                                              "type": "string"
                                          });
                        }
                        resource.operations.push({
                                                     method: $(this).val(),
                                                     parameters: tempPara,
                                                     nickname: $(this).val().toLowerCase() + '_' + $("#resource_url_pattern").val()
                                                 });
                        ic++
                    }
                    vc++;
                }
            });
            if (vc == 0) {
                BootstrapDialog.alert("You should select at least one HTTP verb.");
                return;
            }
            event.data.add_resource(resource, $('#inputResource').val());
            //RESOURCES.unshift(resource);
            $("#resource_url_pattern").val("");
            $(".http_verb_select").attr("checked", false);
        });


    }

    APIDesigner.prototype.check_if_resource_exist = function (path, method) {
        var apis = this.query("$.apis[*].file.apis[*]");
        for (var i = 0; i < apis.length; i++) {
            if (apis[i].path == path) {
                for (var j = 0; j < apis[i].operations.length; j++) {
                    if (apis[i].operations[j].method == method) {
                        return true;
                    }
                }
            }
        }
        return false;
    }


    APIDesigner.prototype.set_default_management_values = function () {
        var operations = this.query("$.apis[*].file.apis[*].operations[*]");
        for (var i = 0; i < operations.length; i++) {
            if (!operations[i].auth_type) {
                if (operations[i].method == "OPTIONS") {
                    operations[i].auth_type = OPTION_DEFAULT_AUTH;
                }
                else {
                    operations[i].auth_type = DEFAULT_AUTH;
                }
            }
            if (!operations[i].throttling_tier) {
                operations[i].throttling_tier = DEFAULT_TIER;
            }
        }
    }

    APIDesigner.prototype.add_default_resource = function () {
        $("#resource_url_pattern").val("*");
        $(".http_verb_select").attr("checked", "checked");
        $("#inputResource").val("Default");
        $("#add_resource").trigger('click');
    }

    APIDesigner.prototype.get_scopes = function () {
        if (typeof(this.api_doc.authorizations) != 'undefined') {
            var scopes = this.api_doc.authorizations.oauth2.scopes;
            var options = [{"value": "", "text": ""}]
            for (var i = 0; i < scopes.length; i++) {
                options.push({"value": scopes[i].key, "text": scopes[i].name});
            }
            return options;
        }
    }

    APIDesigner.prototype.has_resources = function () {
        if (this.api_doc.apis.length == 0) {
            return false;
        }
    }

    APIDesigner.prototype.display_elements = function (value, source) {
        for (var i = 0; i < source.length; i++) {
            if (value == source[i].value) {
                $(this).text(source[i].text);
            }
        }
    };

    APIDesigner.prototype.update_elements = function (resource, newValue) {
        var API_DESIGNER = APIDesigner();
        var obj = API_DESIGNER.query($(this).attr('data-path'));
        var obj = obj[0]
        var i = $(this).attr('data-attr');
        obj[i] = newValue;
    };

    APIDesigner.prototype.update_elements_boolean = function (resource, newValue) {
        if (newValue == "true") {
            newValue = true;
        } else {
            newValue = false;
        }
        var API_DESIGNER = APIDesigner();
        var obj = API_DESIGNER.query($(this).attr('data-path'));
        var obj = obj[0]
        var i = $(this).attr('data-attr');
        obj[i] = newValue;
    };

    APIDesigner.prototype.clean_resources = function () {
        for (var i = 0; i < this.api_doc.apis.length; i++) {
            for (var j = 0; j < this.api_doc.apis[i].file.apis.length; j++) {
                if (this.api_doc.apis[i].file.apis[j].operations.length == 0) {
                    this.api_doc.apis[i].file.apis.splice(j, 1);
                }
            }
            if (this.api_doc.apis[i].file.apis.length == 0) {
                this.api_doc.apis.splice(i, 1);
            }
        }
    }

    APIDesigner.prototype.init_controllers = function () {
        var API_DESIGNER = this;

        $("#version").change(function (e) {
            APIDesigner().api_doc.apiVersion = $(this).val();
            // We do not need the version anymore. With the new plugable version strategy the context will have the version
            APIDesigner().baseURLValue = "http://localhost:8280/" + $("#context").val().replace("/", "")
        });
        $("#context").change(function (e) {
            APIDesigner().baseURLValue = "http://localhost:8280/" + $(this).val().replace("/", "")
        });
        $("#name").change(function (e) {
            APIDesigner().api_doc.info.title = $(this).val()
        });
        $("#description").change(function (e) {
            APIDesigner().api_doc.info.description = $(this).val()
        });

        this.container.delegate(".delete_resource", "click", function (event) {
            var operations = API_DESIGNER.query($(this).attr('data-path'));
            var operations = operations[0]
            var i = $(this).attr('data-index');
            var pn = $(this).attr('data-path-name');
            BootstrapDialog.confirm('Do you want to remove "'+operations[i].method+' : '+pn+'" resource from list.', function(result){
                if(result) {
                    API_DESIGNER = APIDesigner();
                    operations.splice(i, 1);
                    API_DESIGNER.clean_resources();
                    API_DESIGNER.render_resources();
                }
            });
            //delete resource if no operations
        });

        this.container.delegate(".movedown_resource", "click", function () {
            var operations = API_DESIGNER.query($(this).attr('data-path'));
            var operations = operations[0]
            var i = parseInt($(this).attr('data-index'));
            if (i != (operations.length - 1)) {
                var tmp = operations[i];
                operations[i] = operations[i + 1];
                operations[i + 1] = tmp;
            }
            API_DESIGNER.render_resources();
        });

        this.container.delegate(".moveup_resource", "click", function () {
            var operations = API_DESIGNER.query($(this).attr('data-path'));
            var operations = operations[0];
            var i = parseInt($(this).attr('data-index'));
            if (i != 0) {
                var tmp = operations[i];
                operations[i] = operations[i - 1];
                operations[i - 1] = tmp;
            }
            API_DESIGNER.render_resources();
        });

        this.container.delegate(".add_parameter", "click", function (event) {
            var parameter = $(this).parent().find('.parameter_name').val();
            if (parameter == "") {
                return false;
            }
            var resource_body = $(this).parent().parent();
            var resource = API_DESIGNER.query(resource_body.attr('data-path'));
            var resource = resource[0]
            if (resource.parameters == undefined) {
                resource.parameters = [];
            }
            resource.parameters.push({name: parameter, paramType: "query", required: false, type: "string"});
            //@todo need to checge parent.parent to stop code brak when template change.
            API_DESIGNER.render_resource(resource_body);
        });

        this.container.delegate(".delete_scope", "click", function () {
            var i = $(this).attr("data-index");
            API_DESIGNER.api_doc.authorizations.oauth2.scopes.splice(i, 1);
            API_DESIGNER.render_scopes();
        });

        this.container.delegate("#define_scopes", 'click', function () {
            $("#scopeName").val('');
            $("#scopeDescription").val('');
            $("#scopeKey").val('');
            $("#scopeRoles").val('');
            $("#define_scope_modal").modal('show');
        });

        $("#scope_submit")
                .click(
                function () {
                    var scope = {
                        name: $("#scopeName").val(),
                        description: $("#scopeDescription").val(),
                        key: $("#scopeKey").val(),
                        roles: $("#scopeRoles").val()
                    };
                    if (API_DESIGNER.api_doc.authorizations.oauth2.scopes == undefined) {
                        SCOPES = [];
                    }
                    for (var i = 0; i < API_DESIGNER.api_doc.authorizations.oauth2.scopes.length; i++) {
                        if (API_DESIGNER.api_doc.authorizations.oauth2.scopes[i].key === $(
                                        "#scopeKey").val() || API_DESIGNER.api_doc.authorizations.oauth2.scopes[i].key === $(
                                        "#scopeName").val()) {
                            BootstrapDialog.alert('You should not define same scope.');
                            return;
                        }
                    }

                    API_DESIGNER.api_doc.authorizations.oauth2.scopes
                            .push(scope);
                    $("#define_scope_modal").modal('hide');
                    API_DESIGNER.render_scopes();
                    API_DESIGNER.render_resources();
                });

        $("#swaggerEditor").click(API_DESIGNER.edit_swagger);

        $("#update_swagger").click(API_DESIGNER.update_swagger);
    }

    APIDesigner.prototype.load_api_document = function (api_document) {
        this.api_doc = api_document
        this.render_resources();
        this.render_scopes();
        $("#version").val(api_document.apiVersion);
        $("#name").val(api_document.info.title);
        if (api_document.info.description) {
            $("#description").val(api_document.info.description);
        }
    };


    APIDesigner.prototype.render_scopes = function () {
        context = {
            "api_doc": this.api_doc
        }
        //var output = Handlebars.partials['scopes-template'](context);
        //$('#scopes_view').html(output);
        var partial = 'scope_template';
        var container = 'scopes_view';
        renderPartialWithContainerName(partial, container, context);

    };


    function renderResourceCallback(that) {
        $('#resource_details').find('.scope_select').editable({
                                                                  emptytext: '+ Scope',
                                                                  source: that.get_scopes(),
                                                                  success: that.update_elements
                                                              });

        if (typeof(TIERS) !== 'undefined') {
            $('#resource_details').find('.throttling_select').editable({
                                                                           emptytext: '+ Throttling',
                                                                           source: TIERS,
                                                                           success: that.update_elements
                                                                       });
        }

        if (typeof(AUTH_TYPES) !== 'undefined') {
            $('#resource_details').find('.auth_type_select').editable({
                                                                          emptytext: '+ Auth Type',
                                                                          source: AUTH_TYPES,
                                                                          autotext: "always",
                                                                          display: that.display_element,
                                                                          success: that.update_elements
                                                                      });
        }

        $('#resource_details').find('.change_summary').editable({
                                                                    emptytext: '+ Summary',
                                                                    success: that.update_elements,
                                                                    inputclass: 'resource_summary'
                                                                });
    }
    APIDesigner.prototype.render_resources = function () {
        context = {
            "api_doc": jQuery.extend(true, {}, this.api_doc),
            "verbs": VERBS,
            "has_resources": this.has_resources()
        };
        var partial = 'implement-resource-template';
        var container = 'resource_details';
        var that = this;
        renderPartialWithContainerName(partial, container, context, that, renderResourceCallback);
    };

    function renderResourcePaddingCallback(that,container) {
        container.show();
        if (container.find('.editor').length) {
            var textarea = container.find('.editor').ace({theme: 'textmate', lang: 'javascript', fontSize: "10pt"});
            var decorator = container.find('.editor').data('ace');
            var aceInstance = decorator.editor.ace;
            aceInstance.getSession().on('change', function (e) {
                operation[0].mediation_script = aceInstance.getValue();
            });
        }

        container.find('.notes').editable({
                                              type: 'textarea',
                                              emptytext: '+ Add Implementation Notes',
                                              success: that.update_elements
                                          });
        container.find('.content_type').editable({
                                                     value: "application/json",
                                                     source: content_types,
                                                     success: that.update_elements
                                                 });
        container.find('.param_desc').editable({
                                                   emptytext: '+ Empty',
                                                   success: that.update_elements
                                               });
        container.find('.param_paramType').editable({
                                                        emptytext: '+ Set Param Type',
                                                        source: [{value: "query", text: "query"}, {
                                                            value: "body",
                                                            text: "body"
                                                        }, {value: "header", text: "header"}, {
                                                                     value: "form",
                                                                     value: "form"
                                                                 }],
                                                        success: that.update_elements
                                                    });
        container.find('.param_type').editable({
                                                   emptytext: '+ Empty',
                                                   success: that.update_elements
                                               });
        container.find('.param_required').editable({
                                                       emptytext: '+ Empty',
                                                       autotext: "always",
                                                       display: function (value, sourceData) {
                                                           if (value == true || value == "true") {
                                                               $(that).text("True");
                                                           }
                                                           if (value == false || value == "false") {
                                                               $(that).text("False");
                                                           }
                                                       },
                                                       source: [{value: true, text: "True"}, {value: false, text: "False"}],
                                                       success: that.update_elements_boolean
                                                   });
    }

    APIDesigner.prototype.render_resource = function (container) {
        var operation = this.query(container.attr('data-path'));
        var context = jQuery.extend(true, {}, operation[0]);
        context.resource_path = container.attr('data-path');
        //var output = Handlebars.partials['designer-resource-template'](context);
        //container.html(output);
        //container.show();
        var partial = 'implement-resource-template-body';
        var that = this;
        renderPartialWithContainer(partial, container,context, that, renderResourcePaddingCallback);
    };

    APIDesigner.prototype.query = function (path) {
        return jsonPath(this.api_doc, path);
    }

    APIDesigner.prototype.add_resource = function (resource, path) {
        var path = path.toLowerCase();
        if (path.charAt(0) != "/") {
            path = "/" + path;
        }
        var i = 0;
        var api = undefined;
        for (i = 0; i < this.api_doc.apis.length; i++) {
            if (this.api_doc.apis[i].path == path) {
                api = this.api_doc.apis[i];
                break;
            }
        }
        if (api == undefined) {
            this.api_doc.apis.push({
                                       path: path,
                                       description: ""
                                   });
        }
        if (this.api_doc.apis[i].file == undefined) {
            this.api_doc.apis[i].file = {
                "apiVersion": this.api_doc.apiVersion,
                "swaggerVersion": "1.2",
                "basePath": this.baseURLValue,
                "resourcePath": path,
                apis: []
            };
        }
        this.api_doc.apis[i].file.apis.push(resource);
        this.render_resources();
    };

    APIDesigner.prototype.edit_swagger = function () {
        var designer = APIDesigner();
        designer.swagger_editor = ace.edit("swagger_editor");
        //var textarea = $('textarea[name="description"]').hide();
        designer.swagger_editor.setFontSize(16);
        designer.swagger_editor.setTheme("ace/theme/textmate");
        designer.swagger_editor.getSession().setMode("ace/mode/yaml");
        designer.swagger_editor.getSession().setValue(jsyaml.safeDump(designer.api_doc));

    };

    APIDesigner.prototype.update_swagger = function () {
        var designer = APIDesigner();
        var json = jsyaml.safeLoad(designer.swagger_editor.getSession().getValue());
        designer.load_api_document(json);
        $('#swaggerEditer').modal('toggle');
    };


    function getContextValue() {
        var context = $('#context').val();
        var version = $('#apiVersion').val();

        if (context == "" && version != "") {
            $('#contextForUrl').html("/{context}/" + version);
            $('#contextForUrlDefault').html("/{context}/" + version);
        }
        if (context != "" && version == "") {
            if (context.charAt(0) != "/") {
                context = "/" + context;
            }
            $('#contextForUrl').html(context + "/{version}");
            $('#contextForUrlDefault').html(context + "/{version}");
        }
        if (context != "" && version != "") {
            if (context.charAt(0) != "/") {
                context = "/" + context;
            }
            $('.contextForUrl').html(context + "/" + version);
        }
        updateContextPattern();
    }

    function updateContextPattern() {
        var context = $('#context').val();
        var version = $('#version').val();

        if (context != "") {
            if (context.indexOf("{version}") < 0) {
                if (!context.endsWith('/')) {
                    context = context + '/';
                }
                context = context + "{version}";
            }
            $('#resource_url_pattern_refix').text(context);
        } else {
            $('#resource_url_pattern_refix').text("/{context}/{version}/");
        }

        if (version) {
            context = context.replace("{version}", version);
            $('#resource_url_pattern_refix').text(context);
        }
    }

    var renderPartialWithContainerName = function (partialName, containerName, data, that ,fn) {
        fn = fn || function () {
        };
        if (!partialName) {
            throw 'A template name has not been specified for template key ' + partialKey;
        }
        if (!containerName) {
            throw 'A container name has not been specified for container key ' + containerKey;
        }
        var obj = {};
        obj[partialName] = partial(partialName);
        caramel.partials(obj, function () {
            var template = Handlebars.partials[partialName](data);
            $(id(containerName)).html(template);
            fn(that);
        });
    };

    var renderPartialWithContainer = function (partialName, container, data, that ,fn) {
        fn = fn || function () {
        };
        if (!partialName) {
            throw 'A template name has not been specified for template key ' + partialKey;
        }
        var obj = {};
        obj[partialName] = partial(partialName);
        caramel.partials(obj, function () {
            var template = Handlebars.partials[partialName](data);
            container.html(template);
            fn(that,container);
        });
    };

    var partial = function (name) {
        return '/extensions/assets/api/themes/' + caramel.themer + '/partials/' + name + '.hbs';
    };

    var id = function (name) {
        return '#' + name;
    };

    APIMangerAPI.APIDesigner = APIDesigner;
});
