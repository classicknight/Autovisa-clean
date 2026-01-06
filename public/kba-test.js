const $ = (id) => document.getElementById(id);

function normHSN(v) {
  return String(v || "").trim().replace(/\D/g, "").slice(0, 4);
}
function normTSN(v) {
  return String(v || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

async function lookup() {
  const hsn = normHSN($("hsn").value);
  const tsn = normTSN($("tsn").value);

  $("hsn").value = hsn;
  $("tsn").value = tsn;

  if (hsn.length !== 4 || tsn.length < 3) {
    $("out").textContent = "Bitte HSN (4 Ziffern) und TSN (mind. 3 Zeichen) eingeben.";
    return;
  }

  $("btn").disabled = true;
  $("out").textContent = "Lade…";

  try {
    const res = await fetch(`/api/hsn-tsn?hsn=${encodeURIComponent(hsn)}&tsn=${encodeURIComponent(tsn)}`);
    const data = await res.json();

    if (!res.ok) {
      $("out").textContent = JSON.stringify({ error: data?.error || "Fehler", details: data }, null, 2);
      return;
    }

    $("out").textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    $("out").textContent = JSON.stringify({ error: "Netzwerk/Serverfehler", details: String(e) }, null, 2);
  } finally {
    $("btn").disabled = false;
  }
}

$("btn").addEventListener("click", lookup);
$("hsn").addEventListener("keydown", (e) => e.key === "Enter" && lookup());
$("tsn").addEventListener("keydown", (e) => e.key === "Enter" && lookup());
