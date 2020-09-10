"use strict";

const request = require("request");
Promise = require("bluebird");
Promise.promisifyAll(request);

module.exports = {getFromAPI, getQueryString} 

async function getFromAPI(api, queryString, callBack) {
  if(!api.url){
    console.error("api.url is required.");
    return;
  }

  function getParamString(params){
    var kv=[];
    if(params){
      if(Array.isArray(params)){
        let result = params.map(p=> getParamString(p));
        kv = kv.concat(result);
      }else if(typeof(params)==="string"){
        kv.push(params);
      }else if(typeof(params)==="object"){
        var keys = Object.keys(params);        
        for (var i = 0; i < keys.length; i++) {
          kv.push(keys[i] + "=" + params[keys[i]]);
        }
      }
    }
    return kv;
  }

  let url=api.url;
  if(!api.url.endsWith("/")){
    url = url + "/";
  }
  var kv=[queryString];
  if(api.params){
    let results =getParamString(api.params);
    kv = kv.concat(results);
    url = url + "?" + kv.join("&");
  }

  const requestParam = {
    url: encodeURI(url),
    headers: api.headers,
    json: true,
  };

  let response = await request.getAsync(requestParam);

  if (response.statusCode != 200) {
    return new Error(`3td API Call failed.${JSON.stringify(api)}`);
  }
  if(callBack){
    callBack(api, response.body);
  }
  return response.body;
};

function getQueryString(api){
  if(!api) return "";
    
  let queryString = "";
  if(api.query){
    let params = api.query;
    let kv =[]; 
    if(Array.isArray(params)){
      params.forEach(param=>{
        kv.push(param.name + param.condition + controller.vars[param.var_name]);
      })
    }else if(typeof(params)==="object"){
      kv.push(params.name + params.condition + controller.vars[params.var_name]);
    }
    queryString = kv.join("&");
  }
  return queryString;
}
