'use strict';

import { Botkit, BotkitConversation, BotkitMessage, BotWorker } from "botkit";

let fs = require("fs");
const buildPath = require("path");
const initPath_JSON = buildPath.join(__dirname, "init_data");
const {getFromAPI, getQueryString} = require("../service/3rdApi");
const Mustache = require('mustache');

module.exports = async function (controller: Botkit) {
  
  //====================================================
  fs.readdirSync(initPath_JSON).forEach((file : string) => {
    var filePath :string = buildPath.join(initPath_JSON, file);
    console.log("datafile:", filePath);
    
    //JSONデータ読取り、
    fs.readFile(filePath, (err, data) => {
      if (err){
        console.log(err);
        return;
      }
      
      var jsonData = JSON.parse(data);
      let isRightAdapter = isValidAdapter(controller, jsonData);
      if(isRightAdapter){
        // init trigger on
        registOn(controller, jsonData);

        // init trigger hears
        registHears(controller, jsonData);

        // init dialog 
        registDialog(controller, jsonData);
      }
    
    })
  });
  //====================================================
  /**
   * jsonに含まれたadapterは適当かの判定
   * @param controller 
   * @param json 
   */
  function isValidAdapter(controller: Botkit, json: {adapter?:"string"|Array<string>}): boolean{
    //your code using json object
    var isRightAdapter = false;
    if(json.adapter){
      if(Array.isArray(json.adapter)){
        if(json.adapter.includes("default")){
          isRightAdapter= true;
        }else if (json.adapter.includes(controller.adapter.name)) {
          isRightAdapter= true;
        }
      }else if ("string" === typeof(json.adapter)) {
        if (json.adapter === controller.adapter.name) {
          isRightAdapter= true;
        }
      }
    }else{
      isRightAdapter= true;
    }
    return isRightAdapter;
  }
  //====================================================
  /**
   * Regist controller.on(event, async function)処理。json.scriptは配列とobjectの２種類が可能
   * @param controller 
   * @param json 
   */
  async function registOn(controller:Botkit, json: {type:string, script?:{events:string,replys?:string|{}|Array<{}>, dialog?:string}}){
    if("on" != json.type || !json.script){
      return;
    }

    //配列または
    if(Array.isArray(json.script)){
      json.script.forEach(script=> onTriggerScript(controller, script));
    }else{
      onTriggerScript(controller, json.script)
    }
  }

  /**
   * Regist controller.on(event, async function)処理。
   * @param controller 
   * @param script 
   */
  async function onTriggerScript(controller:Botkit, script:{events:string,replys?:string|{}|Array<{}>, dialog?:string}){
    controller.on(script.events, async function(bot:BotWorker, message) {
      console.log("On Trigger Script received, ★reply=====>: ", script);
      if(script.replys){
        await replyMessage(bot, message, script.replys);
      }
      if(script.dialog){
        await bot.beginDialog(script.dialog);
      }
    });
  }
  //====================================================
  async function registHears(controller:Botkit, json: {type:string, script?:{events:string,replys?:string|{}|Array<{}>, dialog?:string}}){
    if("hears" != json.type || !json.script){
      return;
    }
    
    if(Array.isArray(json.script)){
      json.script.forEach(script=> AddHearTriggerScript(controller, script));
    }else{
      AddHearTriggerScript(controller, json.script)
    }
  }

  /** 
   * hears処理の設定.
   * １．事前処理として、必須入力チェックにより、未入力変数があれば、入力促進ダイアログを起動させる
   * ２．必須入力が正常であれば、次の処理へ進む
   * controller.hears(keywords, events,async function);
   */
  async function AddHearTriggerScript(controller:Botkit, script){
    script.keywords = convertToRegex(script.keywords, null);
    //hears keywords,
    controller.hears(script.keywords, script.events, async function(bot, message) {
      console.log("AddHearTriggerScript: ", script);
      
      //事前処理として、必須入力キーが存在し、確認ダイアログが存在する場合、ダイアログを起動させる
      if(script.required && script.required.key && script.required.dialog){
        await bot.beginDialog(script.required.dialog);
        return;
      }

      //必須入力OKの場合、次へ進む
      if(script.replys){
        await replyMessage(bot, message, script.replys);
      }
      //関連ダイアログがあれば、起動させる
      if(script.dialog){
        await bot.beginDialog(script.dialog);
      }
    });
  }
  // function isRequiredValid(controller:Botkit, key){
  //   if(Array.isArray(key)){
  //     return key.every(key=> !!controller.vars[key]);
  //   }else{
  //     return !!controller.vars[key]
  //   }
  // }
  //====================================================
  async function registDialog(controller:Botkit, json){
    if("dialog" != json.type || !json.script || !json.id){
      return;
    }

    let convo = new BotkitConversation(json.id, controller);
    json.script.forEach(s=>addScript(convo, s));
    controller.addDialog(convo);
  }
  async function addScript(convo, script){
    addAction(convo, script);
    addAsk(convo, script);    
    addMessage(convo, script);
    addQuestion(convo, script);
    
    addBefore(convo, script.before, script.thread_name);
    addAfter(convo, script);
    addVarValid(script);
  }
  //====================================================  
  async function addAction(convo, script){
    if("action" != script.type){
      return;
    }

    //console.log("addAction===================> :", confirm)
    if(script.thread_name){
      convo.addAction(script.action, script.thread_name);
    }else{
      convo.addAction(script.action);
    }
  }
  async function addAsk(convo, script){
    if("ask" != script.type){
      return;
    }

    if(Array.isArray(script.collect.options)){
      script.collect.options = script.collect.options.map(option=>{
        return toHandler(option);
      });
    }else{
      script.collect.options = toHandler(script.collect.options);
    }
    //console.log("addAsk===================> :", confirm)
    if(!script.collect || !script.collect.options || script.collect.options.length === 0){
      convo.ask(script, async()=>{}, script.collect.key);
    }else{
      convo.ask(script, script.collect.options, script.collect.key)
    }
    //console.log("addAsk key====================>:", script.collect.key);
    await onVarChange(convo, script.collect.key);
  }
  async function addQuestion(convo, script){
    if("question" != script.type){
      return;
    }
    if(script.collect && script.collect.options){
      if(Array.isArray(script.collect.options)){
        script.collect.options = script.collect.options.map(option=>{
          return toHandler(option);
        });
      }else{
        script.collect.options = toHandler(script.collect.options);
      }
    }

    //console.log("addQuestion===================> :", confirm)
    if(!script.collect || !script.collect.options || script.collect.options.length === 0){
      convo.addQuestion(script, async ()=>{}, script.collect.key, script.thread_name)
    }else{
      convo.addQuestion(script, script.collect.options, script.collect.key, script.thread_name)
    }
    //console.log("addQuestion key=========>:", script.collect.key, "==next==>", script.thread_name);
    await onVarChange(convo, script.collect.key);
  }
  async function addMessage(convo, script){
    if("message" != script.type){
      return;
    }
    
    //console.log("addMessage===================> :", confirm)
    let message = {
      type: script.type,
      text: script.text,
      quick_replies: script.quick_replies,
      file: script.file
    }
    console.log("addMessage===================>",message);
    if(script.thread_name){
      convo.addMessage(message, script.thread_name);
    }else{
      convo.addMessage(message);
    }
    if(script.next_dialog){
      convo
    }
  }
  async function addVarValid(script){
    if("variables" != script.type){
      return;
    }
    // if(!controller.validateHandlers){
    //   controller.validateHandlers =[];
    // }
    // await convertToRegex(script.valid, (option)=>{
    //   let opt = controller.validateHandlers.includes(option);
    //   if(!opt){
    //     controller.validateHandlers.push(option);
    //   }
    // });
    
  }
  
  async function addBefore(convo, before, script_thread_name){
    if(!before){
      return;
    }

    if(Array.isArray(before)){
      before.forEach(before=>{
        addBefore(convo, before, script_thread_name);
      });
    }else{
      //指定Threadへ飛ばす前の処理
      await convo.before(script_thread_name, async (convoBefore, bot)=>{
    
        console.log("before====from=> :", script_thread_name)
        let varValue;
        // //対応変数がまだない場合、処理しない
        // if(controller.vars[before.key]){
        //   varValue = controller.vars[before.key];
        // }
        let convoVarValue;
        if(convoBefore.vars[before.key]){
          convoVarValue = convoBefore.vars[before.key];
        }
        console.log("before===varValue,convoVarValue>", varValue, convoVarValue);
        if(!varValue && !convoVarValue)return;

        if(!convoVarValue){
          convoBefore.setVar(before.key, varValue);
          convoVarValue = varValue;
        }
        if(convoVarValue.type==="event")return;
        
        // let option = controller.validateHandlers.find(v => v.key===before.key);
        // if(!option)return;
        
        // //入力チェック正常、かつ飛ばす区分がTrueの場合、before.thread_nameへ
        // if(option.type==="regex"){
        //   if(option.pattern.test(varValue) && before.skip_on_valid){
        //     convoBefore.gotoThread(before.thread_name);
        //   }
        // }else if(option.type==="string"){
        //   if(option.pattern === varValue && before.skip_on_valid){
        //     convoBefore.gotoThread(before.thread_name);
        //   }
        // }
      });
    }
  }
 
  async function addAfter(convo, script){
    if(!script.after){
      return;
    }
    //console.log("addAfter======confirm> :", script)
    
    convo.after((results, bot)=>{
      //外部apiを呼出
      if(script.after.api){
        let api = script.after.api;
        let queryString = getQueryString(api);
        getFromAPI(api, queryString, callBackAPI);
      }

      //Triggerがある場合
      if(script.after.trigger){
        controller.trigger(script.after.trigger, bot, results);
      }
    });
  }
  async function callBackAPI(api, result){
    if(result.Response){
      const textTempalte =api.callback.text;
      const text =  Mustache.render(textTempalte, result);
      result.renderText = text;

      // controller.vars[api.callback.result_name] = result;
      // controller.vars[api.callback.detail_name] = result.renderText;
    }
  }
  
  async function onVarChange(convo, key){
    if("string" === typeof(key)){
      convo.onChange(key, async(response, convo, bot)=>{
        let value = response;
        // let v = controller.validateHandlers.find(k=>k.key===key);
        // if(v){
        //   if(v.pattern.test(value)){
        //     controller.vars[key] =value;
        //   }else{
        //     controller.vars[key] ="";
        //     convo.gotoThread(v.fault_thread_name);
        //   }
        // }else{
        //   controller.vars[key] = response;
        // }
        // //let kv = 
        // console.log(`onVarChange===================[${key}]:[${controller.vars[key]}], ${response}`);
      });
    }else if(Array.isArray(key)){
      key.forEach(k => onVarChange(convo, k));
    }
  }
  
  //====================================================
  function convertToRegex(option, callback){
    if(!option)return option;

    if (Array.isArray(option)){
      option = option.map(op => convertToRegex(op, callback));
      return option;
    }

    // if (typeof(option) === 'string' && option.match(/^\/(.+)\/$/)) {
    //   //文字列にRegexパターンが存在する場合、Regexとする
    //   option = new RegExp(option.substring(1,option.length-1));
    // }else

    if(option.type==="regex" && option.pattern){
      option.pattern = new RegExp(option.pattern);
    }
    
    if(callback){
      callback(option);
    }

    return option;
  }
  function toHandler(option){
    if(!option)return option;

    // Regexの場合、Regexに変換
    option = convertToRegex(option, null);

    if(option.thread_name){
      option.handler = async(response, convo, bot) => {
        console.log("ask/question callback_handler answer============>>>>>>>:", option.thread_name, response);
        await convo.gotoThread(option.thread_name);
      }
    }
    return option;
  }
  
  async function replyMessage(bot, message, replys){
    if(!replys){
      return;
    }

    if(typeof(replys)==="string"){
      await bot.reply(message, {
        type:"text",
        text: replys
      });
      return;
    }
    
    if(Array.isArray(replys)){
      replys.forEach(txt => {
        replyMessage(bot, message, txt)
      });
      return;
    }

    if(typeof(replys)==="object"){
      await bot.reply(message, {
        type:"text",
        text: replys.text,
        quick_replies: replys.quick_replies,
        file: replys.file
      });
      return;
    }
    
  }

}