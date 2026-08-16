// =========================================================
// GOOGLE APPS SCRIPT WEB APP URL
// =========================================================

const API_URL =
  "https://script.google.com/macros/s/AKfycbyr-Er3ENHSOO4sFKrnGWMFm_RHGXtoxBLWWspLamvQdgBUwbDED57t13UHtRi8kBCr7g/exec";



// =========================================================
// HELPER: GET ELEMENT
// =========================================================

const $ = id =>
  document.getElementById(id);



// =========================================================
// SHOW RESULT
// =========================================================

function showResult(
  element,
  html,
  error = false
) {

  element.innerHTML = html;

  element.classList.remove(
    "hidden"
  );

  element.classList.toggle(
    "error",
    error
  );
}



// =========================================================
// CALL GOOGLE APPS SCRIPT
// =========================================================

async function callApi(
  action,
  payload
) {

  if (
    API_URL.includes(
      "PASTE_YOUR"
    )
  ) {

    throw new Error(
      "Google Apps Script Web App URL has not been configured."
    );

  }


  const response =
    await fetch(
      API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },

        body:
          JSON.stringify({
            action,
            ...payload
          })
      }
    );


  if (!response.ok) {

    throw new Error(
      "Server returned HTTP " +
      response.status
    );

  }


  const data =
    await response.json();


  if (!data.ok) {

    throw new Error(
      data.error ||
      "Request failed."
    );

  }


  return data;
}



// =========================================================
// SUBMIT QUESTION
// =========================================================

document
  .getElementById(
    "questionForm"
  )
  .addEventListener(
    "submit",
    async function (e) {

      e.preventDefault();


      const button =
        document.getElementById(
          "submitBtn"
        );


      const result =
        document.getElementById(
          "submitResult"
        );


      button.disabled = true;


      showResult(
        result,
        "Submitting your question..."
      );


      try {

        const files = [];


        // -----------------------------------------------
        // READ FILES
        // -----------------------------------------------

        for (
          const file
          of document
              .getElementById(
                "files"
              )
              .files
        ) {

          if (
            file.size >
            10 * 1024 * 1024
          ) {

            throw new Error(
              `${file.name} is larger than 10 MB.`
            );

          }


          const base64 =
            await fileToBase64(
              file
            );


          files.push({

            name:
              file.name,

            mimeType:
              file.type ||
              "application/octet-stream",

            data:
              base64

          });

        }



        // -----------------------------------------------
        // SEND DATA
        // -----------------------------------------------

        const data =
          await callApi(
            "submit",
            {

              studentName:
                document
                  .getElementById(
                    "studentName"
                  )
                  .value
                  .trim(),

              studentId:
                document
                  .getElementById(
                    "studentId"
                  )
                  .value
                  .trim(),

              studentEmail:
                document
                  .getElementById(
                    "studentEmail"
                  )
                  .value
                  .trim(),

              course:
                document
                  .getElementById(
                    "course"
                  )
                  .value
                  .trim(),

              question:
                document
                  .getElementById(
                    "question"
                  )
                  .value
                  .trim(),

              files

            }
          );



        // -----------------------------------------------
        // SUCCESS
        // -----------------------------------------------

        showResult(
          result,

          `
          <strong>
            Submitted successfully!
          </strong>

          <br><br>

          Your Submission ID is:

          <strong>
            ${escapeHtml(
              data.submissionId
            )}
          </strong>

          <br><br>

          <strong>
            Please save this ID.
          </strong>

          You will need it to check your feedback.
          `
        );


        document
          .getElementById(
            "questionForm"
          )
          .reset();


      }

      catch (err) {

        showResult(
          result,

          escapeHtml(
            err.message
          ),

          true
        );

      }

      finally {

        button.disabled = false;

      }

    }
  );



// =========================================================
// CHECK FEEDBACK
// =========================================================

document
  .getElementById(
    "feedbackForm"
  )
  .addEventListener(
    "submit",
    async function (e) {

      e.preventDefault();


      const result =
        document.getElementById(
          "feedbackResult"
        );


      showResult(
        result,
        "Checking your feedback..."
      );


      try {

        const data =
          await callApi(
            "feedback",
            {

              submissionId:
                document
                  .getElementById(
                    "feedbackId"
                  )
                  .value
                  .trim(),

              studentEmail:
                document
                  .getElementById(
                    "feedbackEmail"
                  )
                  .value
                  .trim()

            }
          );



        let html = `

          <strong>
            Status:
          </strong>

          ${escapeHtml(
            data.status
          )}

          <br><br>


          <strong>
            Your Question:
          </strong>

          <br>

          ${escapeHtml(
            data.question
          ).replace(
            /\n/g,
            "<br>"
          )}

        `;



        // -----------------------------------------------
        // INSTRUCTOR FEEDBACK
        // -----------------------------------------------

        if (
          data.feedback
        ) {

          html += `

            <hr>

            <strong>
              Instructor Feedback:
            </strong>

            <br><br>

            ${escapeHtml(
              data.feedback
            ).replace(
              /\n/g,
              "<br>"
            )}

          `;

        }



        // -----------------------------------------------
        // FEEDBACK FILE
        // -----------------------------------------------

        if (
          data.feedbackFileUrl
        ) {

          html += `

            <br><br>

            <a
              href="${safeUrl(
                data.feedbackFileUrl
              )}"
              target="_blank"
              rel="noopener"
            >
              Open Feedback File
            </a>

          `;

        }


        showResult(
          result,
          html
        );


      }

      catch (err) {

        showResult(
          result,

          escapeHtml(
            err.message
          ),

          true
        );

      }

    }
  );



// =========================================================
// FILE → BASE64
// =========================================================

function fileToBase64(
  file
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const reader =
        new FileReader();


      reader.onload =
        function () {

          const result =
            reader.result;


          const base64 =
            result.split(
              ","
            )[1];


          resolve(
            base64
          );

        };


      reader.onerror =
        reject;


      reader.readAsDataURL(
        file
      );

    }
  );

}



// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,

    function (character) {

      return {

        "&":
          "&amp;",

        "<":
          "&lt;",

        ">":
          "&gt;",

        '"':
          "&quot;",

        "'":
          "&#039;"

      }[character];

    }
  );

}



// =========================================================
// SAFE GOOGLE DRIVE URL
// =========================================================

function safeUrl(
  url
) {

  const value =
    String(
      url || ""
    );


  if (
    /^https:\/\/drive\.google\.com\//i
      .test(value)
  ) {

    return value;

  }


  return "#";
}
