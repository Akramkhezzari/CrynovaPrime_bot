const express = require("express");
const { Bot, InlineKeyboard } = require("grammy");
const fs = require("fs");
const path = require("path");

/* =========================================================
   الإعدادات
========================================================= */

const PORT = process.env.PORT || 10000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID ? String(process.env.ADMIN_ID).trim() : "";

if (!TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN غير موجود");
    process.exit(1);
}

console.log(`🔑 TOKEN موجود: ✅`);
console.log(`👑 ADMIN_ID: ${ADMIN_ID || "غير محدد"}`);

/* =========================================================
   Express Server
========================================================= */

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
    res.status(200).json({ status: "ok", service: "CrynovaPrime" });
});

app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy" });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 خادم الويب يعمل على المنفذ ${PORT}`);
});

/* =========================================================
   Telegram Bot
========================================================= */

const bot = new Bot(TOKEN);

/* =========================================================
   تخزين المستخدمين (محاكاة بسيطة)
========================================================= */

const USERS_FILE = path.join(__dirname, "data", "users.json");

function ensureStorage() {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));
    }
}

function loadUsers() {
    ensureStorage();
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    } catch {
        return {};
    }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

/* =========================================================
   بيانات وهمية للمستخدم (محاكاة)
========================================================= */

function getUserData(userId) {
    const users = loadUsers();
    if (!users[userId]) {
        users[userId] = {
            balance: 0,
            rewards: 0,
            referrals: 0,
            referralEarnings: 0,
            frozen: 0,
            investments: [],
            transactions: []
        };
        saveUsers(users);
    }
    return users[userId];
}

function updateUserData(userId, data) {
    const users = loadUsers();
    users[userId] = { ...users[userId], ...data };
    saveUsers(users);
}

/* =========================================================
   لوحات المفاتيح
========================================================= */

function mainMenu() {
    return new InlineKeyboard()
        .text("💰 الرصيد", "balance")
        .text("📊 الاستثمار", "invest")
        .row()
        .text("💸 السحب", "withdraw")
        .text("📋 السجل", "history")
        .row()
        .text("👥 الإحالات", "referrals")
        .text("❓ مساعدة", "help");
}

function plansKeyboard() {
    return new InlineKeyboard()
        .text("أساسي 5%", "plan_basic")
        .text("متقدم 5.5%", "plan_advanced")
        .row()
        .text("مميز 6%", "plan_premium")
        .text("احترافي 6.5%", "plan_pro")
        .row()
        .text("نخبة 7%", "plan_elite")
        .text("🔙 رجوع", "back_main");
}

function backKeyboard() {
    return new InlineKeyboard().text("🔙 رجوع", "back_main");
}

/* =========================================================
   دوال المساعدة
========================================================= */

function formatNumber(num) {
    return Number(num).toFixed(2);
}

/* =========================================================
   معالج الأزرار (Callback Queries)
========================================================= */

bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    const user = getUserData(userId);

    await ctx.answerCallbackQuery();

    if (data === "back_main") {
        await ctx.editMessageText("🏠 القائمة الرئيسية:", { reply_markup: mainMenu() });
        return;
    }

    if (data === "balance") {
        const msg = `
💰 **رصيدك الحالي:**

💵 الرئيسي: ${formatNumber(user.balance)} دج
🎁 المكافآت: ${formatNumber(user.rewards)} دج
👥 الإحالات: ${formatNumber(user.referralEarnings)} دج
❄️ المجمد: ${formatNumber(user.frozen)} دج

🔹 **الإجمالي القابل للسحب:** ${formatNumber(user.balance + user.rewards + user.referralEarnings)} دج
        `;
        await ctx.editMessageText(msg, { reply_markup: backKeyboard(), parse_mode: "Markdown" });
        return;
    }

    if (data === "invest") {
        const msg = `
📊 **اختر خطة الاستثمار:**

• أساسي: 2000-4999 دج | 5% يومياً
• متقدم: 5000-9999 دج | 5.5%
• مميز: 10000-19999 دج | 6%
• احترافي: 20000-34999 دج | 6.5%
• نخبة: 35000-50000 دج | 7%

⚠️ المدة: 30 يوماً
✨ مكافأة أول استثمار: 7%
        `;
        await ctx.editMessageText(msg, { reply_markup: plansKeyboard() });
        return;
    }

    if (data === "withdraw") {
        const available = user.balance + user.rewards + user.referralEarnings;
        if (available < 1000) {
            await ctx.editMessageText(
                `❌ رصيدك القابل للسحب (${formatNumber(available)} دج) أقل من الحد الأدنى للسحب (1000 دج).`,
                { reply_markup: backKeyboard() }
            );
            return;
        }
        await ctx.editMessageText(
            `💸 **طلب سحب جديد**

الرصيد القابل للسحب: ${formatNumber(available)} دج
الحد الأدنى: 1000 دج
الرسوم: 10%

🔹 لإتمام السحب، استخدم الأمر:
/withdraw المبلغ

مثال: /withdraw 1500
            `,
            { reply_markup: backKeyboard(), parse_mode: "Markdown" }
        );
        return;
    }

    if (data === "history") {
        const txs = user.transactions || [];
        if (txs.length === 0) {
            await ctx.editMessageText("📭 لا توجد عمليات مسجلة.", { reply_markup: backKeyboard() });
            return;
        }
        let msg = "📋 **سجل العمليات (آخر 10):**\n\n";
        const recent = txs.slice(-10).reverse();
        recent.forEach(tx => {
            msg += `• ${tx.date}: ${tx.type} - ${formatNumber(tx.amount)} دج\n`;
        });
        await ctx.editMessageText(msg, { reply_markup: backKeyboard(), parse_mode: "Markdown" });
        return;
    }

    if (data === "referrals") {
        const refLink = `https://t.me/Crynova_bot?start=${userId}`;
        const msg = `
👥 **الإحالات**

رابط الإحالة الخاص بك:
\`${refLink}\`

👤 المدعوين المباشرين: ${user.referrals || 0}
💰 أرباح الإحالات: ${formatNumber(user.referralEarnings)} دج

📌 تربح 15% من إيداع المدعو المباشر، و5% من إيداع مدعو مدعوك.
        `;
        await ctx.editMessageText(msg, {
            reply_markup: new InlineKeyboard()
                .text("📤 مشاركة الرابط", "share_referral")
                .text("🔙 رجوع", "back_main"),
            parse_mode: "Markdown"
        });
        return;
    }

    if (data === "share_referral") {
        const refLink = `https://t.me/Crynova_bot?start=${userId}`;
        await ctx.editMessageText(
            `📤 شارك هذا الرابط مع أصدقائك:\n\n${refLink}`,
            { reply_markup: backKeyboard() }
        );
        return;
    }

    if (data === "help") {
        await ctx.editMessageText(
            `❓ **المساعدة**

• /start - القائمة الرئيسية
• /balance - عرض الرصيد
• /invest - بدء استثمار جديد
• /withdraw المبلغ - طلب سحب
• /history - سجل العمليات
• /referral - رابط الإحالة

للتواصل مع الدعم: @Crynova_bot
            `,
            { reply_markup: backKeyboard(), parse_mode: "Markdown" }
        );
        return;
    }

    // خطط الاستثمار
    const planMap = {
        plan_basic: { name: "أساسي", min: 2000, max: 4999, rate: 5 },
        plan_advanced: { name: "متقدم", min: 5000, max: 9999, rate: 5.5 },
        plan_premium: { name: "مميز", min: 10000, max: 19999, rate: 6 },
        plan_pro: { name: "احترافي", min: 20000, max: 34999, rate: 6.5 },
        plan_elite: { name: "نخبة", min: 35000, max: 50000, rate: 7 }
    };

    if (planMap[data]) {
        const plan = planMap[data];
        const msg = `
📈 **خطة ${plan.name}**

• المبلغ: ${plan.min} - ${plan.max} دج
• العائد اليومي: ${plan.rate}%
• المدة: 30 يوماً

🔹 لإتمام الاستثمار، استخدم الأمر:
/invest ${plan.name} المبلغ

مثال: /invest أساسي 3000
        `;
        await ctx.editMessageText(msg, { reply_markup: backKeyboard() });
        return;
    }

    await ctx.editMessageText("⚠️ خيار غير معروف.", { reply_markup: backKeyboard() });
});

/* =========================================================
   أوامر البوت
========================================================= */

bot.command("start", async (ctx) => {
    const name = ctx.from?.first_name || "خويا";
    await ctx.reply(
        `🚀 مرحباً ${name} في CrynovaPrime.\n\nأنا البوت الرئيسي للاستثمار وإدارة المحفظة.\nاختر من القائمة أدناه:`,
        { reply_markup: mainMenu() }
    );
});

bot.command("balance", async (ctx) => {
    const user = getUserData(ctx.from.id);
    const msg = `
💰 **رصيدك الحالي:**

💵 الرئيسي: ${formatNumber(user.balance)} دج
🎁 المكافآت: ${formatNumber(user.rewards)} دج
👥 الإحالات: ${formatNumber(user.referralEarnings)} دج
❄️ المجمد: ${formatNumber(user.frozen)} دج

🔹 **الإجمالي القابل للسحب:** ${formatNumber(user.balance + user.rewards + user.referralEarnings)} دج
    `;
    await ctx.reply(msg, { parse_mode: "Markdown" });
});

bot.command("invest", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 3) {
        await ctx.reply(
            `❌ استخدم: /invest [الخطة] [المبلغ]\n\nالخطط المتاحة: أساسي، متقدم، مميز، احترافي، نخبة\nمثال: /invest أساسي 3000`
        );
        return;
    }

    const planName = args[1];
    const amount = Number(args[2]);

    const planMap = {
        أساسي: { min: 2000, max: 4999, rate: 5 },
        متقدم: { min: 5000, max: 9999, rate: 5.5 },
        مميز: { min: 10000, max: 19999, rate: 6 },
        احترافي: { min: 20000, max: 34999, rate: 6.5 },
        نخبة: { min: 35000, max: 50000, rate: 7 }
    };

    const plan = planMap[planName];
    if (!plan) {
        await ctx.reply("❌ الخطة غير صحيحة. اختر: أساسي، متقدم، مميز، احترافي، نخبة");
        return;
    }

    if (amount < plan.min || amount > plan.max) {
        await ctx.reply(`❌ المبلغ يجب أن يكون بين ${plan.min} و ${plan.max} دج لهذه الخطة.`);
        return;
    }

    const user = getUserData(ctx.from.id);
    if (user.balance < amount) {
        await ctx.reply(`❌ رصيدك الرئيسي (${formatNumber(user.balance)} دج) غير كافٍ.`);
        return;
    }

    // محاكاة الاستثمار
    user.balance -= amount;
    const dailyReturn = amount * (plan.rate / 100);
    const totalReturn = dailyReturn * 30;
    const bonus = amount * 0.07; // 7% مكافأة أول استثمار

    if (!user.transactions) user.transactions = [];
    user.transactions.push({
        date: new Date().toLocaleDateString("ar-DZ"),
        type: `استثمار ${planName}`,
        amount: -amount
    });

    // إضافة المكافأة لأول استثمار فقط (محاكاة)
    if (!user._hasInvested) {
        user.rewards += bonus;
        user._hasInvested = true;
        user.transactions.push({
            date: new Date().toLocaleDateString("ar-DZ"),
            type: "مكافأة أول استثمار",
            amount: bonus
        });
    }

    updateUserData(ctx.from.id, user);

    await ctx.reply(
        `✅ **تم الاستثمار بنجاح!**

📊 الخطة: ${planName}
💰 المبلغ: ${formatNumber(amount)} دج
📈 العائد اليومي: ${formatNumber(dailyReturn)} دج
📆 إجمالي العائد بعد 30 يوم: ${formatNumber(totalReturn)} دج
🎁 مكافأة أول استثمار: ${formatNumber(bonus)} دج (أضيفت للمكافآت)

✨ استمر في الاستثمار لزيادة أرباحك!
        `,
        { parse_mode: "Markdown" }
    );
});

bot.command("withdraw", async (ctx) => {
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
        await ctx.reply("❌ استخدم: /withdraw المبلغ\nمثال: /withdraw 1500");
        return;
    }

    const amount = Number(args[1]);
    if (isNaN(amount) || amount < 1000) {
        await ctx.reply("❌ الحد الأدنى للسحب هو 1000 دج.");
        return;
    }

    const user = getUserData(ctx.from.id);
    const available = user.balance + user.rewards + user.referralEarnings;

    if (available < amount) {
        await ctx.reply(`❌ رصيدك القابل للسحب (${formatNumber(available)} دج) أقل من ${formatNumber(amount)} دج.`);
        return;
    }

    const fee = amount * 0.1;
    const total = amount + fee;

    // خصم من الأرصدة (من الأقدم للأحدث)
    let remaining = amount;
    let deducted = { balance: 0, rewards: 0, referralEarnings: 0 };

    if (user.balance >= remaining) {
        user.balance -= remaining;
        deducted.balance = remaining;
        remaining = 0;
    } else {
        deducted.balance = user.balance;
        remaining -= user.balance;
        user.balance = 0;
    }

    if (remaining > 0 && user.rewards >= remaining) {
        user.rewards -= remaining;
        deducted.rewards = remaining;
        remaining = 0;
    } else if (remaining > 0) {
        deducted.rewards = user.rewards;
        remaining -= user.rewards;
        user.rewards = 0;
    }

    if (remaining > 0 && user.referralEarnings >= remaining) {
        user.referralEarnings -= remaining;
        deducted.referralEarnings = remaining;
        remaining = 0;
    } else if (remaining > 0) {
        deducted.referralEarnings = user.referralEarnings;
        user.referralEarnings = 0;
    }

    if (!user.transactions) user.transactions = [];
    user.transactions.push({
        date: new Date().toLocaleDateString("ar-DZ"),
        type: "سحب",
        amount: -total
    });

    updateUserData(ctx.from.id, user);

    await ctx.reply(
        `✅ **تم طلب السحب بنجاح!**

💰 المبلغ المطلوب: ${formatNumber(amount)} دج
🧾 الرسوم (10%): ${formatNumber(fee)} دج
💳 الإجمالي المخصوم: ${formatNumber(total)} دج

📌 سيتم تحويل المبلغ إلى حساب Baridi Mob الخاص بك خلال 24 ساعة.
        `,
        { parse_mode: "Markdown" }
    );
});

bot.command("history", async (ctx) => {
    const user = getUserData(ctx.from.id);
    const txs = user.transactions || [];
    if (txs.length === 0) {
        await ctx.reply("📭 لا توجد عمليات مسجلة.");
        return;
    }
    let msg = "📋 **سجل العمليات:**\n\n";
    const recent = txs.slice(-10).reverse();
    recent.forEach(tx => {
        msg += `• ${tx.date}: ${tx.type} - ${formatNumber(tx.amount)} دج\n`;
    });
    await ctx.reply(msg, { parse_mode: "Markdown" });
});

bot.command("referral", async (ctx) => {
    const userId = ctx.from.id;
    const user = getUserData(userId);
    const refLink = `https://t.me/Crynova_bot?start=${userId}`;
    await ctx.reply(
        `👥 **رابط الإحالة الخاص بك:**\n\n${refLink}\n\n👤 المدعوين: ${user.referrals || 0}\n💰 أرباح الإحالات: ${formatNumber(user.referralEarnings)} دج`,
        { parse_mode: "Markdown" }
    );
});

bot.command("help", async (ctx) => {
    await ctx.reply(
        `❓ **قائمة الأوامر:**

• /start - القائمة الرئيسية
• /balance - عرض الرصيد
• /invest الخطة المبلغ - استثمار جديد
• /withdraw المبلغ - طلب سحب
• /history - سجل العمليات
• /referral - رابط الإحالة

للاستفسارات: @Crynova_bot`
    );
});

/* =========================================================
   Keep-Alive
========================================================= */

const KEEP_ALIVE_INTERVAL = 4 * 60 * 1000;
function keepAlive() {
    fetch(`http://localhost:${PORT}/health`)
        .then(res => console.log(`🔄 [Keep-Alive] ${res.status}`))
        .catch(err => console.error(`⚠️ [Keep-Alive] ${err.message}`));
}
setTimeout(keepAlive, 5000);
setInterval(keepAlive, KEEP_ALIVE_INTERVAL);

/* =========================================================
   تشغيل البوت
========================================================= */

let botRunning = false;

async function startBot() {
    if (botRunning) return;
    try {
        await bot.start({
            onStart: (info) => {
                console.log(`✅ تم تشغيل @${info.username}`);
                botRunning = true;
            },
            drop_pending_updates: true
        });
    } catch (error) {
        console.error("❌ فشل التشغيل:", error);
        botRunning = false;
        setTimeout(startBot, 10000);
    }
}

startBot();

setInterval(() => {
    if (!botRunning) {
        console.warn("⚠️ البوت متوقف، إعادة تشغيل...");
        startBot();
    } else {
        bot.api.getMe().catch(() => {
            console.warn("⚠️ البوت لا يستجيب، إعادة تشغيل...");
            botRunning = false;
            startBot();
        });
    }
}, 3 * 60 * 1000);
