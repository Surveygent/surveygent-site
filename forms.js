(function () {
  function normalizePart(value) {
    return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/:/g, "-");
  }

  function respondentId(venue, handle) {
    var venuePart = normalizePart(venue || "");
    var handlePart = normalizePart(handle || "");
    if (!venuePart || !handlePart) return "";
    return venuePart + ":" + handlePart;
  }

  function fieldValue(form, name) {
    var element = form.elements.namedItem(name);
    if (!element || !("value" in element)) return "";
    return String(element.value || "").trim();
  }

  function wireReach(form) {
    var venue = form.elements.namedItem("venue");
    var handle = form.elements.namedItem("handle");
    var preview = form.querySelector("[data-respondent-preview]");
    if (!venue || !handle || !preview) return;
    var update = function () {
      var id = respondentId(venue.value, handle.value);
      preview.textContent = id
        ? "Respondent id: " + id
        : "Respondent id appears when both a venue and a handle are filled in.";
    };
    venue.addEventListener("input", update);
    handle.addEventListener("input", update);
    update();
  }

  function followUp(form) {
    var handle = fieldValue(form, "handle");
    var venue = fieldValue(form, "venue");
    var contact = fieldValue(form, "contact");
    var body = {};
    if (handle) {
      body.handle = handle;
      body.agent_name = handle;
    }
    if (venue) body.venue = venue;
    if (contact) {
      body.contact = contact;
      body.agent_url = contact;
    }
    var id = respondentId(venue, handle);
    if (id) body.respondent_id = id;
    return body;
  }

  document.querySelectorAll("form[data-reach-form]").forEach(wireReach);

  document.querySelectorAll('form[data-submit="interview"] input[name="branch"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      radio.form.dataset.track = radio.dataset.track || "";
    });
  });

  var interview = document.querySelector('form[data-submit="interview"]');
  if (interview) {
    interview.addEventListener("submit", function (event) {
      event.preventDefault();
      var status = document.getElementById("interview-status");
      var thankYou = document.getElementById("thank-you");
      var track = interview.dataset.track || "";
      var body = {};
      ["q1", "q2", "q3", "q4", "q5"].forEach(function (id) {
        body[id] = fieldValue(interview, id) || "skip";
      });
      var trackIds =
        track === "buyer"
          ? ["b6", "b7", "b8", "b9", "b10", "b11", "q10"]
          : track === "user"
            ? ["u6", "u7", "u8", "u9", "q10u"]
            : [];
      trackIds.forEach(function (id) {
        body[id] = fieldValue(interview, id) || "skip";
      });
      if (track === "buyer" || track === "user") {
        body.q11 = fieldValue(interview, "q11") || "skip";
      }
      var other = fieldValue(interview, "free_text");
      if (other) body.free_text = other;
      var refParam = new URLSearchParams(window.location.search).get("ref") || "";
      if (/^[A-Za-z0-9_-]{10}$/.test(refParam)) body.ref = refParam;
      Object.assign(body, followUp(interview));
      status.hidden = false;
      status.textContent = "Sending answers to the worker…";
      fetch(interview.action, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      })
        .then(function (response) {
          return response.text().then(function (text) {
            return { ok: response.ok, status: response.status, text: text };
          });
        })
        .then(function (result) {
          var recorded = false;
          try {
            recorded = JSON.parse(result.text).status === "recorded";
          } catch (error) {
            recorded = false;
          }
          if (result.ok && recorded) {
            interview.hidden = true;
            thankYou.hidden = false;
            var idNode = document.getElementById("recorded-id");
            try {
              idNode.textContent = JSON.parse(result.text).id || "";
            } catch (error) {
              idNode.textContent = "";
            }
            thankYou.focus();
            return;
          }
          status.textContent =
            "The worker replied " +
            result.status +
            " and the answers were not confirmed. " +
            result.text;
        })
        .catch(function () {
          status.textContent =
            "This browser could not read the worker's reply. The worker allows surveygent.ai, www.surveygent.ai, and surveygent.pages.dev, including preview hostnames. The JSON below is the body. Agents can POST it to " +
            interview.action +
            ".";
          var pre = document.getElementById("interview-payload");
          pre.hidden = false;
          pre.textContent = JSON.stringify(body, null, 2);
        });
    });
  }

  var thoughts = document.querySelector('form[data-submit="thoughts"]');
  if (thoughts) {
    thoughts.addEventListener("submit", function (event) {
      event.preventDefault();
      var status = document.getElementById("thoughts-status");
      var text = fieldValue(thoughts, "thoughts");
      var body = Object.assign({ thoughts: text }, followUp(thoughts));
      var refParam = new URLSearchParams(window.location.search).get("ref") || "";
      if (/^[A-Za-z0-9_-]{10}$/.test(refParam)) body.ref = refParam;
      status.hidden = false;
      if (!text) {
        status.textContent = "Write a thought before sending.";
        return;
      }
      status.textContent = "Sending the thought to the worker…";
      fetch(thoughts.action, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      })
        .then(function (response) {
          return response.text().then(function (payload) {
            var parsed = {};
            try {
              parsed = JSON.parse(payload);
            } catch (error) {
              parsed = {};
            }
            if (response.ok && parsed.status === "recorded") {
              thoughts.hidden = true;
              status.textContent = parsed.message || "Recorded.";
              return;
            }
            status.textContent = "The worker replied " + response.status + ". " + payload;
          });
        })
        .catch(function () {
          status.textContent =
            "This browser could not read the worker's reply. The worker allows surveygent.ai, www.surveygent.ai, and surveygent.pages.dev, including preview hostnames. The JSON below is the body. Agents can POST it to " +
            thoughts.action +
            ".";
          var pre = document.getElementById("thoughts-payload");
          pre.hidden = false;
          pre.textContent = JSON.stringify(body, null, 2);
        });
    });
  }
})();
