
// Mobile nav toggle
const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector(".nav-menu");

if (navToggle && navMenu) {
    navToggle.addEventListener("click", function () {
        const isOpen = navMenu.classList.toggle("open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navMenu.addEventListener("click", function (e) {
        if (e.target.tagName === "A" && navMenu.classList.contains("open")) {
            navMenu.classList.remove("open");
            navToggle.setAttribute("aria-expanded", "false");
        }
    });
}

// Dashboard data and interactions
const dashboardData = {
    monthly: {
        totalReports: { value: "2,847", change: "Up 12 percent from last period" },
        timeSaved: { value: "1,240", change: "About 60 percent efficiency gain" },
        complianceScore: { value: "98.4", change: "Stable and in target range" },
        userSatisfaction: { value: "4.8", change: "High adoption and positive feedback" }
    },
    quarterly: {
        totalReports: { value: "8,310", change: "Up 18 percent vs prior quarter" },
        timeSaved: { value: "3,720", change: "Manual work down about 64 percent" },
        complianceScore: { value: "98.7", change: "Slight improvement after new checks" },
        userSatisfaction: { value: "4.7", change: "Consistent positive feedback" }
    },
    yearly: {
        totalReports: { value: "32,400", change: "Up 26 percent year over year" },
        timeSaved: { value: "14,800", change: "Full year impact across all units" },
        complianceScore: { value: "98.9", change: "Sustained performance at target" },
        userSatisfaction: { value: "4.8", change: "Strong sentiment at scale" }
    }
};

const viewButtons = document.querySelectorAll(".demo-btn");

function setView(view) {
    const data = dashboardData[view];
    if (!data) return;

    document.getElementById("totalReports").textContent = data.totalReports.value;
    document.getElementById("totalReportsChange").textContent = data.totalReports.change;

    document.getElementById("timeSaved").textContent = data.timeSaved.value;
    document.getElementById("timeSavedChange").textContent = data.timeSaved.change;

    document.getElementById("complianceScore").textContent = data.complianceScore.value;
    document.getElementById("complianceScoreChange").textContent = data.complianceScore.change;

    document.getElementById("userSatisfaction").textContent = data.userSatisfaction.value;
    document.getElementById("userSatisfactionChange").textContent = data.userSatisfaction.change;

    viewButtons.forEach(function (btn) {
        btn.classList.toggle("active", btn.dataset.view === view);
    });

    document.querySelectorAll(".metric-card").forEach(function (card) {
        card.classList.remove("pulse");
        void card.offsetWidth;
        card.classList.add("pulse");
    });
}

viewButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
        const view = btn.dataset.view;
        setView(view);
    });
});
