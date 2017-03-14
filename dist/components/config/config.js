'use strict';

System.register(['./config.html!text', 'lodash'], function (_export, _context) {
  "use strict";

  var configTemplate, _, _createClass, WorldPingConfigCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_configHtmlText) {
      configTemplate = _configHtmlText.default;
    }, function (_lodash) {
      _ = _lodash.default;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export('ConfigCtrl', WorldPingConfigCtrl = function () {
        function WorldPingConfigCtrl($scope, $injector, $q, backendSrv, alertSrv) {
          _classCallCheck(this, WorldPingConfigCtrl);

          this.$q = $q;
          this.backendSrv = backendSrv;
          this.alertSrv = alertSrv;
          this.validKey = false;
          this.quotas = {};
          this.appEditCtrl.setPreUpdateHook(this.preUpdate.bind(this));
          this.appEditCtrl.setPostUpdateHook(this.postUpdate.bind(this));
          this.org = null;

          if (this.appModel.jsonData === null) {
            this.appModel.jsonData = {};
          }
          if (!this.appModel.secureJsonData) {
            this.appModel.secureJsonData = {};
          }
          if (this.appModel.enabled) {
            var self = this;
            this.validateKey().then(function () {
              self.validateDatasources();
            });
          }
        }

        _createClass(WorldPingConfigCtrl, [{
          key: 'reset',
          value: function reset() {
            this.appModel.jsonData.apiKeySet = false;
            this.validKey = false;
            this.errorMsg = "";
            this.org = null;
          }
        }, {
          key: 'validateKey',
          value: function validateKey() {
            var self = this;
            var p = this.backendSrv.get('api/plugin-proxy/raintank-worldping-app/api/v2/quotas');
            p.then(function (resp) {
              if (resp.meta.code !== 200) {
                self.alertSrv.set("failed to get Quotas", resp.message, 'error', 10000);
                return self.$q.reject(resp.message);
              }
              self.validKey = true;
              self.errorMsg = "";
              self.quotas = resp.body;

              self.getOrgDetails();
            }, function (resp) {
              if (self.appModel.enabled) {
                self.alertSrv.set("failed to verify apiKey", resp.statusText, 'error', 10000);
                self.appModel.enabled = false;
                self.appModel.jsonData.apiKeySet = false;
                self.appModel.secureJsonData.apiKey = "";
                self.errorMsg = "invalid apiKey";
                self.validKey = false;
              }
            });
            return p;
          }
        }, {
          key: 'getOrgDetails',
          value: function getOrgDetails() {
            var self = this;
            var p = this.backendSrv.get('api/plugin-proxy/raintank-worldping-app/api/grafana-net/profile/org');
            p.then(function (resp) {
              self.org = resp;

              var millionChecksPerMonth = Math.ceil(parseInt(self.org.checksPerMonth, 10) / 100000) / 10;
              if (millionChecksPerMonth > 1000) {
                self.org.strChecksPerMonth = Math.ceil(millionChecksPerMonth / 1000) + ' Billion';
              } else if (millionChecksPerMonth > 0) {
                self.org.strChecksPerMonth = millionChecksPerMonth + ' Million';
              } else {
                self.org.strChecksPerMonth = 'N/A';
              }
            }, function (resp) {
              self.alertSrv.set("failed to get Org Details", resp.statusText, 'error', 10000);
            });
            return p;
          }
        }, {
          key: 'preUpdate',
          value: function preUpdate() {
            var model = this.appModel;
            if (!model.enabled) {
              model.jsonData.apiKeySet = false;
              model.secureJsonData.apiKey = "";
              return this.$q.resolve();
            }

            if (!model.jsonData.apiKeySet && !model.secureJsonData.apiKey) {
              model.enabled = false;
              this.errorMsg = "apiKey not set";
              this.validKey = false;
              return this.$q.reject("apiKey not set.");
            }
            model.jsonData.apiKeySet = true;
            return this.configureDatasource();
          }
        }, {
          key: 'postUpdate',
          value: function postUpdate() {
            if (!this.appModel.enabled) {
              return this.$q.resolve();
            }
            var self = this;
            return this.validateKey().then(function () {
              return self.appEditCtrl.importDashboards().then(function () {
                return {
                  url: "dashboard/db/worldping-home",
                  message: "worldPing app installed!"
                };
              });
            });
          }
        }, {
          key: 'validateDatasources',
          value: function validateDatasources() {
            var self = this;
            return this.getDatasources().then(function (datasources) {
              if (!datasources.graphite || !datasources.elastic || datasources.graphite.access === "direct" || datasources.elasitc.access === "direct") {
                self.appModel.enabled = false;
                self.appModel.jsonData.apiKeySet = false;
                self.errorMsg = "Datasource updates required. Please re-enter your apiKey.";
                return;
              }
            });
          }
        }, {
          key: 'getDatasources',
          value: function getDatasources() {
            var self = this;
            //check for existing datasource.
            return self.backendSrv.get('/api/datasources').then(function (results) {
              var datasources = {
                graphite: null,
                elastic: null
              };
              _.forEach(results, function (ds) {
                if (ds.name === "raintank") {
                  datasources.graphite = ds;
                }
                if (ds.name === "raintankEvents") {
                  datasources.elastic = ds;
                }
              });
              return self.$q.resolve(datasources);
            });
          }
        }, {
          key: 'configureDatasource',
          value: function configureDatasource() {
            var self = this;
            //check for existing datasource.
            return this.getDatasources().then(function (datasources) {
              var promises = [];

              var graphite = {
                name: 'raintank',
                type: 'graphite',
                url: 'https://tsdb-gw.raintank.io/graphite/',
                access: 'proxy',
                basicAuth: true,
                basicAuthPassword: self.appModel.secureJsonData.apiKey,
                basicAuthUser: "api_key",
                jsonData: {}
              };

              if (!datasources.graphite) {
                // create datasource.
                promises.push(self.backendSrv.post('/api/datasources', graphite));
              } else if (!_.isMatch(datasources.graphite, graphite)) {
                // update datasource if necessary
                promises.push(self.backendSrv.put('/api/datasources/' + datasources.graphite.id, _.merge({}, datasources.graphite, graphite)));
              }

              var elastic = {
                name: 'raintankEvents',
                type: 'elasticsearch',
                url: 'https://tsdb-gw.raintank.io/elasticsearch/',
                access: 'proxy',
                basicAuth: true,
                basicAuthPassword: self.appModel.secureJsonData.apiKey,
                basicAuthUser: "api_key",
                database: '[events-]YYYY-MM-DD',
                jsonData: {
                  esVersion: 2,
                  interval: "Daily",
                  timeField: "timestamp"
                }
              };

              if (!datasources.elastic) {
                // create datasource.
                promises.push(self.backendSrv.post('/api/datasources', elastic));
              } else if (!_.isMatch(datasources.elastic, elastic)) {
                // update datasource if necessary
                promises.push(self.backendSrv.put('/api/datasources/' + datasources.elastic.id, _.merge({}, datasources.elastic, elastic)));
              }

              return self.$q.all(promises);
            });
          }
        }]);

        return WorldPingConfigCtrl;
      }());

      WorldPingConfigCtrl.template = configTemplate;

      _export('ConfigCtrl', WorldPingConfigCtrl);
    }
  };
});
//# sourceMappingURL=config.js.map
