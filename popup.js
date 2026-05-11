const VALIDATE_EMAIL_URL = "https://n8n.simplebusinesssolutions.org/webhook/cx/validateEmail";
const GET_PEOPLE_URL = "https://n8n.simplebusinesssolutions.org/webhook/cx/getPeople";

const ITEM_EXISTS_URL = "https://n8n.simplebusinesssolutions.org/webhook/cx/itemExists";
const ADD_TO_INBOX_URL = "https://n8n.simplebusinesssolutions.org/webhook/cx/addToInbox";
const ERROR_URL="https://n8n.simplebusinesssolutions.org/webhook/cx/error";

const FEATURESET={
  EXTENSION_SUPPORT:"recxuB4CnddVb7HO4",
  TASK_MANAGEMENT:"recQbcQcZIMDtDEii",
  FINANCIAL_MANAGEMENT:"recQeOHwonwMiZysy"
}


let featureSet={
  "thoughtInbox":false,
  "desireInbox":false,
  "mindsetMastery":false
}
let taskModeLockedForWishlist=false;

//Get features from api
//Replace features based on response from api and set featureSet.


const PEOPLE_NONE = false;
document.addEventListener("DOMContentLoaded", async () => {

  const accountButton = document.getElementById("validateEmail");
  accountButton.classList.add("infoElement");

  const emailInput = document.getElementById("email");
  const registeredEmailLabel=document.getElementById("registeredEmail");
  const switchContextButton = document.createElement("div");
  switchContextButton.id = "switchPeople";
  switchContextButton.textContent = "Switch Subaccount";
  switchContextButton.classList.add("infoElement");
  switchContextButton.classList.add("link");
  registeredEmailLabel.after(switchContextButton);


  const toggleContaionerJQ=$("#flip-switch-container");
  jQuery('<label class="toggle-switch">\n' +
      '   <input type="checkbox" />\n' +
      '    <span class="slider"></span> \n' +
      '</label>').appendTo(toggleContaionerJQ);
  toggleContaionerJQ.prepend('<div style="text-align: right" class="slider_left slider_option"><strong>Thought</strong><br/><em style="font-size:0.9em">Daily Inbox</em></div>');
  toggleContaionerJQ.append('<div class="slider_right slider_option"><strong>Desire</strong><br/><em style="font-size: 0.9em;">Budget Inbox</em></div>');
  const modeToggleSwitch=document.querySelector("#flip-switch-container input");
  const modeToggleSwitchLeftOption=document.querySelector("#flip-switch-container .slider_left");
  const modeToggleSwitchRightOption=document.querySelector("#flip-switch-container .slider_right");
  const modeLabel_Header=document.querySelector(".ee-modename");

  const status = document.getElementById("status");


  const addToInboxButton=document.createElement("button");
  addToInboxButton.id = "addToInbox";

  status.after(addToInboxButton);


function isLoggedOut() {
  return accountButton.textContent === "Log Out";
}

  accountButton.addEventListener("click", async () => {
    if (isLoggedOut()) {
      logOut();
    } else {
      login();
    }
  });
  emailInput.addEventListener("keyup",async (event)=>{
    if(event.code ==="Enter"){
      login();
    }
  });
  switchContextButton.addEventListener("click", () => {
    //This button shouldn't be enabled if there is only one person, or no people
    // chrome.storage.local.get(["people","mode"], ({ people}) => {
    //   if (people) {
    //     selectASubaccount(people);
    selectASubaccount();
    //   }
    // });
  });
  modeToggleSwitch.addEventListener("change",(e)=>{
    if (taskModeLockedForWishlist && e.target.checked===true){
      e.preventDefault();
      setThoughtModeOn();
      return;
    }
    modeToggleSwitch.toggleAttribute("checked",e.target.checked);
    chrome.storage.local.remove("people");
    chrome.storage.local.remove("selectedPersonId");

    setStoredModeIsDesire(e.target.checked);
  });
  function setStoredModeIsDesire(modeIsDesire=false){
    const mode=(modeIsDesire===MODE_DESIRE)?MODE_DESIRE_STRING:MODE_TASK_STRING;// e.target.checked;
    chrome.storage.local.set({mode},()=>{
      //TODO: Validate personId is valid for the selected mode
      loadNewModeProperties(()=>{
        checkIfItemExistsInInbox();
        parsedDataViewValidationUpdate();
      });
    });
  }



  addToInboxButton.addEventListener("click", async () => {

    try{

      //TODO: Refactor to a view initialization
      addToInboxButton.disabled=true;
      displayModeSwitch(true);


      //verify that the proper feature is enabled for the given action
      const financeFeatureEnabled=await ifFinancialSupportEnabled();
      const taskFeatureEnabled=await taskSupportEnabled();

      //if mode is task, verify task
      if (isModeDesire() && !financeFeatureEnabled) {
        reportError("NOT ADDED\nError: your currently have desire mode set, but the desire feature is not enabled in your account. \n Try logging out and back in or contact support.");
        return;
      }

      if (!isModeDesire() && !taskFeatureEnabled){
        reportError("NOT ADDED\nError: your currently have task mode set, but task feature is not enabled in your account. \n try logging out and back in or contact support.");
        return;
      }

      //if mode is desire, verify financial inbox feature


      chrome.storage.local.get(["email","selectedPersonId","clientID","mode"],async ({email, selectedPersonId,clientID,mode})=>{
        if (!email) alert("No email registered. This error should never happen.");



        //TODO: test that this sends properly based on mode
        let body={
          email,title:getParsedTitle(),url:document.URL,selectedPersonId,
          mode,
          clientID
        };
        if(isModeDesire()) {
          let price=jQuery("#" + price_id);
          body = { ...body,price:price.val() };
        }


        fetch(ADD_TO_INBOX_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then((response) => {
          if (response.ok) {
            setStatus("Item added to " + (isModeDesire()===MODE_DESIRE?" financial ":" daily ") + " inbox!");
          }
        })
            .catch((e)=>{
              addToInboxButton.disabled=false;
              reportError("Error: " + e.message,e)
            });
      });
    }
    catch (e){
      reportError(e.message,e);
      actionButtonDisplay(true);
    }

  });



  function reportError(errorText,errorObject){


    errorObject?console.error(errorText,errorObject):console.error(errorText);
    // alert(errorText);
    setStatus(errorText);

    //Report error to web service
    const body={
      "source":"extension",
      "description":errorText,
      "errorObject":errorObject
    };

    fetch(ERROR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((response) => {

    });

    // throw new Error(errorText);
  }




  async function isFeatureSupported(featureID){
    const  currentFeatures=(await chrome.storage.local.get("features"))?.features;

    if(currentFeatures){
      return (currentFeatures?.indexOf(featureID)>0)??false;
    }

    return false;
  }
  async function extensionSupportEnabled(){
    return isFeatureSupported(FEATURESET.EXTENSION_SUPPORT);
  }
  async function taskSupportEnabled(){
    return isFeatureSupported(FEATURESET.TASK_MANAGEMENT)
  }
  async function ifFinancialSupportEnabled(){
    return isFeatureSupported(FEATURESET.FINANCIAL_MANAGEMENT);
  }


  function showSwitchAccountButtonBasedonState(){
    chrome.storage.local.get(["people","mode","selectionByMode"],({people,mode,selectionByMode})=>{
      if (people||(selectionByMode && mode))  ((people?.length??0>0 ) || (selectionByMode?.mode?.id?.length??0>0))  ? enableSwitchAccountButton() : disableSwitchAccountButton();
    });

    // if  enableSwitchAccountButton();

  }
  function disableSwitchAccountButton(){
    switchContextButton.style.display = "none"; // Initially hidden
  }
  function enableSwitchAccountButton(){
    switchContextButton.style.display="block";
  }



  function setPriceVisible(flag=true){
    const price=jQuery("#"+price_id);
    const priceLabel=jQuery("label[for='"+price_id+"']");
    price.toggle(flag);
    priceLabel.toggle(flag);
  }
  function setDesireEnabledOrNot(status){
    (status===MODE_DESIRE)?enableDesireOption():disableDesireOption();
  }


  function displayModeSwitch(willBeVisible=true){
    toggleContaionerJQ.toggle(willBeVisible);
  }


  function setStatus(newStatus){
    status.innerHTML=`<p>${newStatus}</p>`;
  }
  async function getActiveTabData() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => resolve(tab || null));
    });
  }

  function isAmazonWishlistUrl(url = "") {
    return /amazon\.[^/]+\/(hz\/wishlist|wishlist)/i.test(url);
  }
  function isAmazonProductUrl(url = "") {
    return /amazon\.[^/]+\/(dp|gp\/product)\//i.test(url);
  }
  function appendStatus(addToStatus){
    status.innerHTML+=`<p>${addToStatus}</p>`;
  }
  function configureViewControls(){

    chrome.storage.local.get(["email","mode","selectedPersonId","people","selectionByMode"], async ({email, mode,selectedPersonId,people,selectionByMode}) => {

      if (email){
        ( await isFeatureSupported(FEATURESET.FINANCIAL_MANAGEMENT) ) ? displayModeSwitch(true) : displayModeSwitch(false) ;

        if (selectedPersonId || people === PEOPLE_NONE) {
          await parsePageData();
          parsedDataViewValidationUpdate();
          await maybePromptToImportAmazonWishlist();
        }

        loadNewModeProperties();
        actionButtonDisplay(true);

      }else{
        actionButtonDisplay(false);
      }
    });
  }



  /**
   * Retrieves the selected subaccount based on the list of supported people based on the mode chosen.
   * This allows the selected subaccount to be selected on a per-mode basis.
   */
   function loadNewModeProperties(func){
    //TODO: Make sure selectedpersonId is in people
    //TODO: Mode people to its own "Subaccount" object - set/get/checkIfPersonExists/setSelectedAccount/getSelectedAccount
    return  chrome.storage.local.get(["selectedPersonId","people","mode","selectionByMode"], ({ selectedPersonId,people,mode,selectionByMode }) => {
      //Redo selectedPersonID to be selectedPEOPLEID based on mode as key
      //choose the selected person for the mode

      //No id selected
      if (!selectedPersonId) {
        //ID's Available?
        if (selectionByMode && (selectionByMode[mode]?.id?.length ?? 0)) {
          let matchingCache = selectionByMode[mode]
          if (matchingCache) {
            setSelectedPerson(matchingCache);
          } else {
            fetchSubAccountsAndMaybeChoose(true);
          }
        } else {
          //Disabled because there is no way to reset the cache remotely, and without doing that we will always havw two situations
          // 1: we still have a persistent people cache for both modes, or
          // 2: we need to cache the people from both modes, which no longer apply when the cache changes
          // Keeping this off ensures a fresh fetch from the api.
          if (people?.length ?? 0 > 0) {
            if (people.length === 1) {
              setSelectedPerson(people?.mode?people.mode[0]:people);
            } else {
              selectASubaccount();
            }
          } else if (people !==PEOPLE_NONE) {
            fetchSubAccountsAndMaybeChoose(true);
          }
        }
      }
      (mode==="desire")?modeToggleSwitch.setAttribute("checked","checked"):modeToggleSwitch.removeAttribute("checked");
      updateEmailLabelWithAccountFromLocalStorage();
      showSwitchAccountButtonBasedonState();
      if (func) {
        func();
      }
    });
  }
  function fetchSubAccountsAndMaybeChoose(selectAfterFetch=true) {
    //TODO: change refs to this function to point to a "selectIfInvalidSubaccount saved"
    //TODO: pass "mode"
    chrome.storage.local.get(["email","mode","clientID"],async ({email,mode,clientID})=>{
      //Assume API call will always return at least one properly formatted person - validation is up the svc
      try {
        const peopleResponse = await fetch(GET_PEOPLE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({email ,mode,id:clientID}),
        })

        if (peopleResponse.ok) {
          const people = await peopleResponse.json();
          chrome.storage.local.set({"people":people});//, selectedPersonId: people[0]?.id }, () => {

          showSwitchAccountButtonBasedonState()
          if (selectAfterFetch) selectASubaccount();

          // loadNewModeProperties();
        } else {
          console.error("Failed to fetch registered people.");
          disableSwitchAccountButton();
        }
      } catch (error) {
        reportError("Error fetching people:", error);
        disableSwitchAccountButton()
      }
    });
  }

  function selectASubaccount(){
    chrome.storage.local.get(["people"],async ({people})=>{

      if (!people && people!==PEOPLE_NONE) {
        fetchSubAccountsAndMaybeChoose(true);
        return;
      }


      // people=Array.from(people);
      // Prompt user to select a person
      const accountNames = people?people?.map((person) => person.name):false;
      if (accountNames.length===1){
        setSelectedPerson(accountNames[0].name);
      }

      if (accountNames.length>1) {
        const newPersonName = prompt("Select a sub account:\n" + accountNames.join("\n"));
        if (newPersonName) {
          const selectedPerson = people.find((person) => person.name.toLowerCase() === newPersonName.toLowerCase());

          if (selectedPerson) {
            setSelectedPerson(selectedPerson);
          } else {
            alert("You did not enter a correct person.");
            selectASubaccount();
          }
        } else {
          alert("You must select a subaccount.\n\nContact your facilitator for assistance if needed.");
          selectASubaccount();
          return;
        }

        // parsedDataViewValidationUpdate();
      }
      configureViewControls();
      updateEmailLabelWithAccountFromLocalStorage();

    });
  }
  function setSelectedPerson(personObject){
    try {
      let selectedPersonId = personObject?.id??true;
      chrome.storage.local.set({selectedPersonId});

      chrome.storage.local.get(["selectionByMode"], (result)=>{
        let selectionByMode=result?.selectionByMode??{};
        let mode=getModeString();
        selectionByMode[mode]=personObject;
        chrome.storage.local.set({ selectionByMode});
      });



    }
    catch(e){
      alert("There was an error setting the person. Please log out and back in again.");
      console.error("Error setting person with object: " + JSON.stringify(personObject));
    }
  }

  function setThoughtModeOn(){
    modeToggleSwitch.removeAttribute("checked");
    // setStoredModeIsDesire(false);

  }
  function setDesireModeOn(){
    modeToggleSwitch.setAttribute("checked","checked");
    // setStoredModeIsDesire(true);

  }
  function enableDesireOption(){

     ifFinancialSupportEnabled().then((enabled)=>{
       if (enabled===true){
         // setDesireModeOn();
         modeToggleSwitch.removeAttribute("disabled");
         modeToggleSwitchRightOption.classList.remove("disabled");

         toggleContaionerJQ.show();
         // setPriceVisible(true)
       }else{
         // reportError("Desire mode cannot be turned on because the desire feature on your account is not enabled.");
       }
     });
  }
  function disableDesireOption(){
    setThoughtModeOn();
    modeToggleSwitch.setAttribute("disabled",true);
    modeToggleSwitchRightOption.classList.add("disabled");
    // toggleContaionerJQ.hide();
  }

  const MODE_DESIRE=true;
  const MODE_TASK=false;
  const MODE_DESIRE_STRING="desire";
  const MODE_TASK_STRING="task";
  //TODO: rewrite the below two methods to check the mode localstorage instead of the gui to follow MVC pattern.
  function isModeDesire(){
    // let currentMode="";
    // currentMode=await chrome.storage.local.get("mode");
    // return currentMode==="desire";
    return !!(modeToggleSwitch.hasAttribute("checked"));
  }
  function getModeString(){
    return isModeDesire()?"desire":"task";
  }


  // const recheck=document.getElementById("rescheck");
  // recheck.addEventListener("click",parsePageData)


  const price_id="parsedPrice";
  const NA_STRING="N/A";
  // Parse page data and check if item exists
  async function parsePageData() {
    disableSwitchAccountButton();
    appendStatus("<br/><i>Reading page data....</i><br/>");

    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          function:  scrapePageData,
        },
        async (results) => {
          let result=results[0]?.result;
          if(result){
            const { title, price, url } = result;
            // alert(price);
            displayParsedData(title, price, url);
            await checkIfItemExistsInInbox(); // Check if item exists before enabling the "Add to Inbox" button
          }
        }
      );
    });
  }
  async function maybePromptToImportAmazonWishlist() {
    const tab = await getActiveTabData();
    const pageUrl = tab?.url || "";
    const isWishlistPage = isAmazonWishlistUrl(pageUrl);
    const isProductPage = isAmazonProductUrl(pageUrl);
    if (!tab?.id || (!isWishlistPage && !isProductPage)) {
      taskModeLockedForWishlist=false;
      modeToggleSwitch.removeAttribute("disabled");
      return;
    }

    const financialModeEnabled = await ifFinancialSupportEnabled();
    const mode = financialModeEnabled ? MODE_DESIRE_STRING : MODE_TASK_STRING;
    if (isModeDesire() !== financialModeEnabled) setStoredModeIsDesire(financialModeEnabled);

    renderWishlistImportBanner(financialModeEnabled, async (shouldImport) => {
      if (!shouldImport) {
        taskModeLockedForWishlist=true;
        setThoughtModeOn();
        modeToggleSwitch.removeAttribute("checked");
        modeToggleSwitch.setAttribute("disabled","disabled");
        modeToggleSwitchRightOption.classList.add("disabled");
        setStatus("Wishlist import skipped. Task mode is now enabled for this wishlist.");
        displayModeSwitch(true);
        actionButtonDisplay(true);
        parsePageData().then(() => {
          parsedDataViewValidationUpdate();
          checkIfItemExistsInInbox();
        });
        return;
      }
      taskModeLockedForWishlist=false;
      modeToggleSwitch.removeAttribute("disabled");
      await importAmazonWishlistItems(tab.id, mode, isWishlistPage);
    });
  }

  function renderWishlistImportBanner(financialModeEnabled, onDecision){
    const inboxName=financialModeEnabled?"financial":"task";
    setStatus(`
      <div style="border:1px solid #d7e3ff;background:#f5f8ff;padding:10px;border-radius:8px;">
        <div style="font-weight:bold;margin-bottom:6px;">Amazon wishlist detected</div>
        <div style="font-size:12px;margin-bottom:10px;">Would you like to add these item(s) to your ${inboxName} inbox?</div>
        <div style="display:flex;gap:8px;">
          <button id="wishlistImportYes" style="flex:1;">Yes, import</button>
          <button id="wishlistImportNo" style="flex:1;">No</button>
        </div>
      </div>
    `);
    document.getElementById("wishlistImportYes")?.addEventListener("click",()=>onDecision(true),{once:true});
    document.getElementById("wishlistImportNo")?.addEventListener("click",()=>onDecision(false),{once:true});
  }

  async function importAmazonWishlistItems(tabId, mode, isWishlistPage) {
    chrome.storage.local.get(["email", "selectedPersonId", "clientID"], async ({ email, selectedPersonId, clientID }) => {
      if (!email) return;
      addToInboxButton.style.display = "none";
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId },
          function: isWishlistPage ? scrapeAmazonWishlistItems : scrapeAmazonProductAsWishlistItem,
        });

        const items = (result?.result || []).filter((item) => item.title);
        if (!items.length) {
          setStatus("No wishlist items were detected on this page.");
          return;
        }

      renderWishlistImportProgress(items, 0, "Starting import...");
      let addedCount = 0;
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        renderWishlistImportProgress(items, index, "Checking item...");

        const existsBody = { title: item.title, mode, email, selectedPersonId, clientID };
        const existsResponse = await fetch(ITEM_EXISTS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(existsBody),
        });
        if (!existsResponse.ok) {
          renderWishlistImportProgress(items, index, "Check failed. Skipping item.");
          continue;
        }
        const existsData = await existsResponse.json();
        if (existsData.exists) {
          renderWishlistImportProgress(items, index + 1, "Item already exists. Skipped.");
          continue;
        }

        let addBody = { ...existsBody, url: item.url || item.imageUrl || item.title };
        if (mode === MODE_DESIRE_STRING && item.price) addBody = { ...addBody, price: item.price };
        renderWishlistImportProgress(items, index, "Adding item...");
        const addResponse = await fetch(ADD_TO_INBOX_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(addBody),
        });
        if (addResponse.ok) {
          addedCount += 1;
          renderWishlistImportProgress(items, index + 1, "Item added.");
        } else {
          renderWishlistImportProgress(items, index, "Add failed. Skipping item.");
        }
      }

        renderWishlistImportProgress(items, items.length, `Import complete. Added ${addedCount} new item(s).`);
        await checkIfItemExistsInInbox();
      } finally {
        addToInboxButton.style.display = "block";
      }
    });
  }

  function renderWishlistImportProgress(items, completedCount, summaryText) {
    const safeCompleted = Math.max(0, Math.min(completedCount, items.length));
    const percent = items.length ? Math.round((safeCompleted / items.length) * 100) : 0;
    const activeItem = items[Math.min(safeCompleted, items.length - 1)];
    const imageUrl = activeItem?.imageUrl || "";
    const itemName = activeItem?.title || "N/A";
    const itemPrice = (activeItem?.price || "N/A").trim() || "N/A";

    setStatus(`
      <div style="margin-bottom:8px;"><strong>${summaryText}</strong></div>
      <div style="width:100%;height:12px;border:1px solid #ccc;border-radius:8px;overflow:hidden;background:#f2f2f2;margin-bottom:8px;">
        <div style="height:100%;width:${percent}%;background:#4caf50;transition:width .2s;"></div>
      </div>
      <div style="font-size:12px;margin-bottom:8px;">${safeCompleted}/${items.length} (${percent}%)</div>
      <div style="display:flex;gap:8px;align-items:flex-start;padding:8px;border:1px solid #ddd;border-radius:8px;background:#fafafa;">
        <div style="min-width:64px;min-height:64px;width:64px;height:64px;background:#fff;border:1px solid #eee;display:flex;align-items:center;justify-content:center;overflow:hidden;">
          ${imageUrl ? `<img src="${imageUrl}" alt="Item image" style="max-width:100%;max-height:100%;" />` : '<span style="font-size:11px;color:#999;">No image</span>'}
        </div>
        <div style="flex:1;">
          <div style="font-size:13px;line-height:1.3;"><strong>${itemName}</strong></div>
          <div style="font-size:12px;color:#333;margin-top:4px;">${itemPrice}</div>
        </div>
      </div>
    `);
  }
  // Display parsed data with editable textboxes
  function displayParsedData(title, price, url) {

    // const validEntry=title;


    setStatus(`
        <label><strong>Title:</strong></label>
        <input type="text" id="parsedTitle" value="${title}" style="margin-bottom: 10px;" /><br>
        <label for="${price_id}"><strong>Price:</strong></label>
        <input type="text" id="${price_id}"value="${price || NA_STRING}" /><br>
      `);

    document.querySelector("#"+price_id).addEventListener("keyup",()=>{
      parsedDataViewValidationUpdate();
    });

    parsedDataViewValidationUpdate();

  }
  function getParsedTitle(){
    return $("#parsedTitle").val();
  }

  function parsedDataViewValidationUpdate(){
    //TODO: Check features available; if price exists and money inbox off, set to general
    //if price exists, default to money
    //if money off, change to task
    const price=jQuery("#"+price_id);
    let validInput=false;

    if (price?.val()??0){
      const priceValue=price?.val().trim()??"";

      let validPrice=(price.val()!==NA_STRING && (priceValue.match(/^(\$)*\d{1,3}(\.[0-9]{2})?$|^(\$)*(\d{1,3},)+\d{3}(\.[0-9]{2})?$/g)!==null));


      ifFinancialSupportEnabled().then((enabled)=>{
        chrome.storage.local.get(["mode"],async ({mode})=>{
          const isDesire=(mode==="desire");
          setPriceVisible(enabled && isDesire);
          (isDesire)?modeLabel_Header.innerHTML="Financial":modeLabel_Header.innerHTML="Task";

        });

        // setDesireEnabledOrNot()
        validPrice?setDesireModeOn():setThoughtModeOn();
        loadNewModeProperties();

      });

      //TODO: Mode to on text change
      validInput=( (getParsedTitle().trim().length>0) &&
          (getModeString()==="desire"?validPrice:true) );   //use validprice to validate if the mode is desire
    }

    addToInboxButton.disabled = !validInput;
    addToInboxButton.textContent = validInput ? "Add to Inbox" : "All Values Required";
  }


  // Check if item exists
  async function checkIfItemExistsInInbox() {
    //Must re-call here due to context switch
    const addToInboxButton = document.getElementById("addToInbox");

    //Local storage, get email.
    chrome.storage.local.get(["email","selectedPersonId","clientID"],async ({email, selectedPersonId,clientID})=> {
      let body={title:getParsedTitle(),mode:getModeString(),email,selectedPersonId ,clientID };

      try {
        const response = await fetch(ITEM_EXISTS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const data = await response.json();

          if (data.exists) {
            addToInboxButton.disabled = true;
            addToInboxButton.textContent = "Item Already Exists";
          }
        } else {
          throw new Error("ItemExists check failed");
        }
      } catch (error) {
        reportError("Error checking if item exists:", error);

        // Re-enable button if it was disabled
        if (addToInboxButton.disabled) {
          addToInboxButton.disabled = false;
          addToInboxButton.textContent = "Add to Inbox";
        }
      }
    });

  }

// Clear parsed data when logging out
  function clearPageData() {
    const status = document.getElementById("status");
    setStatus("");

    addToInboxButton.disabled=true;
    //document.getElementById("addToInbox")?.remove();
  }


  function login(){
    const email = emailInput.value;

    if (!email) {
      setStatus("Please enter a valid email.");
      return;
    }

    function enableLoginControls(enabled){
      //Enable load controls
      emailInput.disabled=!enabled;
      enabled?accountButton.style.display="block":accountButton.style.display="none";
      if (enabled) accountButton.focus();
    }
    enableLoginControls(false);
    setStatus("Logging in...");


    // Validate email via webhook
    try {
      const response = fetch(VALIDATE_EMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).then((response)=>{
        if (response.ok) {

          response.json().then((json)=>{
            //Get the provided features, clientId, name, and auth and cache

            json=json[0];

            const features=json?.features;
            const jsonEmail=json.email;
            const name=json?.firstName;
            const authToken=json?.authToken;
            const clientID=json?.id;

            if (!authToken || !jsonEmail) {
              reportError("API did not authorize your email.\nContact support and provide email address " + jsonEmail);
              enableLoginControls(true);
            }



            chrome.storage.local.set({ email:jsonEmail,name,features,clientID }, () => {
              console.debug("Logged in with user " + email + " [" + clientID + "]");
              // accountButton.textContent = "Log Out";
              setStatus("Email " + email + " validated successfully!");
              appendStatus("Reading " + (name?name + "'s ":"") + "account information...");
              setTimeout(()=>{
                updateRegisteredEmailOnView(json.email);
                configureViewControls();
                enableLoginControls(true);
              },1500);

            });



          });



        } else {
          response.text().then((t)=>{
            setStatus("Failed to validate email.<br/>Reason: " + t);
            configureViewControls();
            enableLoginControls(true);
          });
        }

      });

    } catch (error) {
      reportError("An error occurred during validation.",error);
      enableLoginControls(true);

    }
  }
  function updateRegisteredEmailOnView(email){
    registeredEmailLabel.innerText = "Logged in as: \n" + email;
    registeredEmailLabel.style.display="block";
    registeredEmailLabel.classList.add("infoElement");

    accountButton.textContent = "Log Out";

    emailInput.style.display="none";
  }
  function updateEmailLabelWithAccount(accountName){
    jQuery(registeredEmailLabel).append("   [" + accountName.toUpperCase() + "]");
  }
  function updateEmailLabelWithAccountFromLocalStorage(){
    //Assumes that all properies have been set.
    chrome.storage.local.get(["email","people","selectedPersonId","mode","selectionByMode"],({email,people,selectedPersonId,mode,selectionByMode})=>{
      // registeredEmailLabel.innerText = "Logged in as: \n" + email;
      updateRegisteredEmailOnView(email);


      if (selectedPersonId){
        if (mode && selectionByMode && selectionByMode[mode] && selectionByMode[mode].name){
          ///DOES NOT SELECT PROPERLY
          updateEmailLabelWithAccount(selectionByMode[mode].name);
        }else{
          if (people && people.length > 0 && selectedPersonId.trim().length>0) {
            updateEmailLabelWithAccount(people.find((person) => person.id === selectedPersonId).name);
            }
        }
      }

      showSwitchAccountButtonBasedonState();
    })

  }
  function logOut() {
    // Log out user and reset form
    chrome.storage.local.remove(["email", "people", "selectedPersonId","selectionByMode","mode"], () => {
      clearRegisteredEmailOnView();
      disableSwitchAccountButton();
      displayModeSwitch(false);
      setStatus("Logged out successfully.");
      clearPageData();
      actionButtonDisplay(false);
    });
  }
  function clearRegisteredEmailOnView(){
    emailInput.value = "";
    emailInput.disabled=false;
    emailInput.style.display="block";
    registeredEmailLabel.style.display="none";
    accountButton.textContent = "Log In";
    // accountButton.classList="";
    // actionButtonDisplay(false);
  }
  function actionButtonDisplay(show=true){
    show?addToInboxButton.style.display="block":addToInboxButton.style.display="none";
  }



  // On popup load, check stored email and personId

  //disabled / features off by default
  disableSwitchAccountButton();
  displayModeSwitch(false);
  configureViewControls();
});


// Function to scrape page data
function scrapePageData() {
  const PRICE_SELECTORS="[itemprop='price'], .price, .product-price, .a-price .a-offscreen";

  const title = document.title;
  const url = window.location.href;

  let results={};
  try{
    const priceEl = document.querySelector(PRICE_SELECTORS);
    const price = priceEl ? priceEl.innerText.trim() : null;
    // alert(price);
    results={ title, price, url };
  }
  catch(e){
    results={title,url};
  }
  finally{
  }


  // alert(JSON.stringify(results));
  return results;
}

function scrapeAmazonWishlistItems() {
  const dedup = new Set();
  const items = [];

  // Amazon wishlist pages consistently expose item links with id="itemName_<LIST_ITEM_ID>".
  const itemAnchors = Array.from(document.querySelectorAll("a[id^='itemName_'], #g-items a.a-link-normal[id*='itemName']"));

  itemAnchors.forEach((anchor) => {
    const title = (anchor.getAttribute("title") || anchor.textContent || "").trim();
    if (!title) return;
    const dedupKey = title.toLowerCase();
    if (dedup.has(dedupKey)) return;

    const container = anchor.closest("[id^='item_'], .g-item-sortable, li, .a-fixed-left-grid, .a-row") || document;
    const listItem = anchor.closest("li[data-itemid], li[data-id], li[data-price]");
    const anchorId = anchor.getAttribute("id") || "";
    const itemIdSuffix = anchorId.startsWith("itemName_") ? anchorId.replace("itemName_", "") : "";
    const itemImageById = itemIdSuffix ? document.querySelector(`#itemImage_${CSS.escape(itemIdSuffix)} img`) : null;
    const listItemImage = listItem?.querySelector("div[id^='itemImage_'] img, a.a-link-normal img, img");
    const dataPrice = listItem?.getAttribute("data-price")?.trim() || "";
    const priceEl = container.querySelector("[id^='itemPrice_'] .a-offscreen, .price-section .a-offscreen, .a-price .a-offscreen, .a-color-price");
    const imageEl = itemImageById || listItemImage || container.querySelector("[id^='itemImage_'] img, .a-link-normal img, img");
    const href = anchor.getAttribute("href") || "";
    const rawPrice = dataPrice || (priceEl?.textContent || "").trim();
    const normalizedPrice = rawPrice && rawPrice.startsWith("$") ? rawPrice : (rawPrice ? `$${rawPrice}` : "");
    const imageSrc = imageEl?.getAttribute("src") || imageEl?.getAttribute("data-src") || imageEl?.getAttribute("data-old-hires") || "";

    dedup.add(dedupKey);
    items.push({
      title,
      price: normalizedPrice,
      url: href.startsWith("http") ? href : new URL(href, window.location.origin).toString(),
      imageUrl: imageSrc,
    });
  });

  return items;
}

function scrapeAmazonProductAsWishlistItem() {
  const title = (document.querySelector("#productTitle")?.textContent || document.title || "").trim();
  const price = (document.querySelector(".a-price .a-offscreen, .a-price-whole")?.textContent || "").trim();
  const canonicalUrl = document.querySelector("link[rel='canonical']")?.href || window.location.href;

  if (!title) return [];
  return [{
    title,
    price,
    url: canonicalUrl,
    imageUrl: document.querySelector("#landingImage, #imgBlkFront, #ebooksImgBlkFront")?.src || "",
  }];
}
