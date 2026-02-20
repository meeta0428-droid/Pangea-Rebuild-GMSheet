document.addEventListener('DOMContentLoaded', () => {
    // ---- 状態管理 ----
    const state = {
        al: 1
    };

    // ---- Firebase連携設定 ----
    // TODO: ここをFirebaseコンソールで取得したご自身のプロジェクトの設定に書き換えてください
    const firebaseConfig = {
        apiKey: "AIzaSyDPls4ObhYos44JRLbSD7AEECaKwsWAfxM",
        authDomain: "pangeniagm.firebaseapp.com",
        databaseURL: "https://pangeniagm-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "pangeniagm",
        storageBucket: "pangeniagm.firebasestorage.app",
        messagingSenderId: "340424843177",
        appId: "1:340424843177:web:dfa24f920f2646dd202eb8"
    };

    let db = null;
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        console.log("Firebase initialized");
    } else {
        console.warn("Firebase未設定です。別ツールとラウンドを同期するには app.js の firebaseConfig を設定してください。");
    }

    // ---- ルームID管理 ----
    let roomId = new URLSearchParams(window.location.search).get('room');
    const roomInput = document.getElementById('room-id-input');
    const roomStatus = document.getElementById('room-status');
    const btnJoinRoom = document.getElementById('btn-join-room');

    if (!roomId) {
        roomId = Math.random().toString(36).substring(2, 10);
        const newUrl = `${window.location.pathname}?room=${roomId}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
    }

    if (roomInput) roomInput.value = roomId;
    if (roomStatus) roomStatus.textContent = `同期中: ${roomId}`;

    if (btnJoinRoom) {
        btnJoinRoom.addEventListener('click', () => {
            const newRoom = roomInput.value.trim();
            if (newRoom && newRoom !== roomId) {
                // 別のルームIDが入力された場合はそのURLへ移動（リロード）
                window.location.href = `${window.location.pathname}?room=${newRoom}`;
            } else {
                // 同じなら現在のルームIDをコピー
                navigator.clipboard.writeText(roomId).then(() => {
                    alert(`ルームID【 ${roomId} 】をコピーしました！\n\nプレイヤーへはこの「ルームID」のみを伝えて、キャラクターシートのURLの末尾に「?room=${roomId}` + `」を付けて開いてもらってください。\n※共有URL（GMの画面）を渡してしまうと、プレイヤーもGMの画面が開いてしまいます。`);
                }).catch(err => {
                    alert("ルームIDのコピーに失敗しました。手動でコピーしてください。");
                });
            }
        });
    }

    // データベースへの同期送信関数
    function syncRoundData(phase, roundNum) {
        if (!db || !roomId) return;
        // ルーム単位で領域を分けて保存
        db.ref(`rooms/${roomId}/gameData/${phase}`).set(roundNum).catch(error => {
            console.error("Firebase Sync Error:", error);
            showToast("システム", "同期エラー", 0, "ラウンドの外部同期に失敗しました");
        });
    }

    // ---- 要素の取得 ----
    const ecTotalInput = document.getElementById('ec-total');
    const playerCountInput = document.getElementById('player-count');
    const alDisplay = document.getElementById('al-display');
    const btnGenerateCore = document.getElementById('btn-generate-core');
    const core1Display = document.getElementById('core-1');
    const core2Display = document.getElementById('core-2');

    // ---- AL（アベレージレベル）計算機能 ----
    function calculateAL() {
        const ecTotal = parseInt(ecTotalInput.value);
        const playerCount = parseInt(playerCountInput.value);

        // バリデーション
        if (isNaN(ecTotal) || isNaN(playerCount) || playerCount <= 0) {
            state.al = 1;
            alDisplay.textContent = 1;
            return;
        }

        const average = ecTotal / playerCount;

        if (average <= 100) state.al = 1;
        else if (average <= 150) state.al = 2;
        else if (average <= 200) state.al = 3;
        else if (average <= 250) state.al = 4;
        else if (average <= 300) state.al = 5;
        else state.al = 6;

        alDisplay.textContent = state.al;

        // ALの変更をトリガーとして全体を更新
        updateTablesBasedOnAL();
    }

    // イベントリスナーの登録
    ecTotalInput.addEventListener('input', calculateAL);
    playerCountInput.addEventListener('input', calculateAL);

    // ---- シナリオコア ランダム決定機能 ----
    const coreList = [
        "命の泉", "豊穣の奇跡", "帰還", "浄化の結界", "嵐", "資源の発見",
        "主の喪失", "環境の安定", "高度医療", "機能の復活", "エネルギー供給",
        "絶対的な平和", "聖域の沈黙", "大地の寿命", "無辜の命", "機械の侵食",
        "生態系の絶滅", "汚染と毒素", "荒野の野性", "進化の可能性", "砂の海",
        "生きた遺跡", "不安定なリソース", "封鎖された世界"
    ];

    btnGenerateCore.addEventListener('click', () => {
        // 配列をシャッフルして先頭2つを取得
        const shuffled = [...coreList].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 2);

        core1Display.textContent = selected[0];
        core2Display.textContent = selected[1];

        // アニメーションの再トリガー
        core1Display.classList.remove('fade-in');
        core2Display.classList.remove('fade-in');

        // DOM要素の再レンダリングを強制してクラスを付け直す
        void core1Display.offsetWidth;

        core1Display.classList.add('fade-in');
        core2Display.classList.add('fade-in');
    });

    // ---- 導入フェイズ：各種決定表 ----
    const introOverallTarget = document.getElementById('intro-overall-target');
    const introEachTarget = document.getElementById('intro-each-target');
    const introStatInputs = [
        document.getElementById('intro-stat-gou'),
        document.getElementById('intro-stat-kou'),
        document.getElementById('intro-stat-chi'),
        document.getElementById('intro-stat-soku'),
        document.getElementById('intro-stat-mi')
    ];
    const introTotalSuccess = document.getElementById('intro-total-success');

    function calculateIntroTotal() {
        let total = 0;
        introStatInputs.forEach(input => {
            total += parseInt(input.value) || 0;
        });
        introTotalSuccess.textContent = total;

        // 全体必要成功数に達したかの見た目更新
        if (total >= (state.al + 6)) {
            introTotalSuccess.style.color = 'var(--success-color)';
            introTotalSuccess.style.textShadow = '0 0 10px rgba(16, 185, 129, 0.5)';
        } else {
            introTotalSuccess.style.color = 'var(--accent-light)';
            introTotalSuccess.style.textShadow = '0 0 15px rgba(96, 165, 250, 0.4)';
        }
    }

    introStatInputs.forEach(input => {
        input.addEventListener('input', calculateIntroTotal);
    });

    // ---- 中盤フェイズ：各種決定表 ----
    const midReqElements = document.querySelectorAll('.mid-req');

    // ---- 中盤フェイズ：戦闘管理 ----
    let midEnemyCount = 0;
    const midEnemyContainer = document.getElementById('mid-enemy-container');
    const btnAddMidEnemy = document.getElementById('btn-add-mid-enemy');

    const midRoundMinus = document.getElementById('mid-round-minus');
    const midRoundPlus = document.getElementById('mid-round-plus');
    const midRoundDisplay = document.getElementById('mid-round-display');
    let midRound = 1;

    midRoundMinus.addEventListener('click', () => {
        if (midRound > 1) {
            midRound--;
            midRoundDisplay.textContent = midRound;
            syncRoundData('midRound', midRound);
        }
    });

    midRoundPlus.addEventListener('click', () => {
        midRound++;
        midRoundDisplay.textContent = midRound;
        syncRoundData('midRound', midRound);
    });

    btnAddMidEnemy.addEventListener('click', () => {
        if (midEnemyCount >= 10) {
            alert("エネミーは最大10体までです。");
            return;
        }
        midEnemyCount++;
        const enemyId = `mid-enemy-${Date.now()}`;

        const card = document.createElement('div');
        card.className = 'enemy-card fade-in';
        card.id = enemyId;

        card.innerHTML = `
            <div class="enemy-header">
                <input type="text" class="enemy-name" value="エネミー ${midEnemyCount}">
                <button class="btn-remove" title="削除">×</button>
            </div>
            <div class="stat-row">
                <div class="stat-item">
                    <label>攻</label>
                    <input type="number" class="stat-input stat-kou" value="3" min="0">
                    <button class="btn-roll" data-stat="攻" data-target=".stat-kou">Roll</button>
                </div>
                <div class="stat-item">
                    <label>防</label>
                    <input type="number" class="stat-input stat-bou" value="3" min="0">
                    <button class="btn-roll" data-stat="防" data-target=".stat-bou">Roll</button>
                </div>
                <div class="stat-item">
                    <label>速</label>
                    <input type="number" class="stat-input stat-soku" value="3" min="0">
                    <button class="btn-roll" data-stat="速" data-target=".stat-soku">Roll</button>
                </div>
                <div class="stat-item">
                    <label>魅</label>
                    <input type="number" class="stat-input stat-mi" value="3" min="0">
                    <button class="btn-roll" data-stat="魅" data-target=".stat-mi">Roll</button>
                </div>
            </div>
            <div class="hp-section">
                <div class="hp-display">
                    <label>HP</label>
                    <input type="number" class="hp-input current-hp" value="30">
                </div>
                <div class="damage-control">
                    <input type="number" class="dmg-input" placeholder="ダメージ量" min="0">
                    <button class="btn-apply-dmg">適用</button>
                </div>
            </div>
        `;

        card.querySelector('.btn-remove').addEventListener('click', () => {
            card.remove();
            midEnemyCount--;
        });

        const currentHpInput = card.querySelector('.current-hp');
        const dmgInput = card.querySelector('.dmg-input');
        card.querySelector('.btn-apply-dmg').addEventListener('click', () => {
            const dmg = parseInt(dmgInput.value) || 0;
            const currentHp = parseInt(currentHpInput.value) || 0;
            if (dmg > 0) {
                const newHp = Math.max(0, currentHp - dmg);
                currentHpInput.value = newHp;
                dmgInput.value = '';

                currentHpInput.style.color = 'var(--danger-color)';
                setTimeout(() => currentHpInput.style.color = 'var(--success-color)', 500);
            }
        });

        const rollerBtns = card.querySelectorAll('.btn-roll');
        const nameInput = card.querySelector('.enemy-name');
        rollerBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const statLabel = btn.getAttribute('data-stat');
                const statTarget = btn.getAttribute('data-target');
                const diceCount = parseInt(card.querySelector(statTarget).value) || 0;

                rollDice(nameInput.value, statLabel, diceCount);
            });
        });

        midEnemyContainer.appendChild(card);
    });

    // ---- ダイスロール共通処理 ----
    const toastContainer = document.getElementById('toast-container');

    function rollDice(actorName, statLabel, diceCount) {
        if (diceCount <= 0) {
            showToast(actorName, statLabel, 0, "ダイス数: 0");
            return;
        }

        const rolls = [];
        let successCount = 0;
        let fumbleCount = 0;

        for (let i = 0; i < diceCount; i++) {
            const r = Math.floor(Math.random() * 6) + 1;
            rolls.push(r);
            if (r >= 4) successCount++;
            if (r === 1) fumbleCount++;
        }

        const details = `生出目: [${rolls.join(', ')}] <br> 1(F): ${fumbleCount} / 2-3: 失敗 / 4-6: 成功`;
        showToast(actorName, statLabel, successCount, details);
    }

    function showToast(actor, stat, successCount, details) {
        const toast = document.createElement('div');
        toast.className = 'toast';

        let resultColor = successCount > 0 ? 'var(--success-color)' : 'var(--text-muted)';

        toast.innerHTML = `
            <div class="toast-title">${actor} の【${stat}】判定 (${details.split('<br>')[0].split(',').length}D6)</div>
            <div>成功数: <span class="toast-result" style="color:${resultColor}">${successCount}</span></div>
            <div class="toast-details">${details}</div>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // ---- 終盤フェイズ：各種決定表 ----
    const endReqElements = document.querySelectorAll('.end-req');
    const endReqCalc1Elements = document.querySelectorAll('.end-req-calc-1');
    const endReqCalc2Elements = document.querySelectorAll('.end-req-calc-2');
    const endReqCalc3Elements = document.querySelectorAll('.end-req-calc-3');

    // ---- 終盤フェイズ：戦闘管理 ----
    let endEnemyCount = 0;
    const endEnemyContainer = document.getElementById('end-enemy-container');
    const btnAddEndEnemy = document.getElementById('btn-add-end-enemy');

    const endRoundMinus = document.getElementById('end-round-minus');
    const endRoundPlus = document.getElementById('end-round-plus');
    const endRoundDisplay = document.getElementById('end-round-display');
    const btnEndRoundResolve = document.getElementById('btn-end-round-resolve');
    let endRound = 1;

    endRoundMinus.addEventListener('click', () => {
        if (endRound > 1) {
            endRound--;
            endRoundDisplay.textContent = endRound;
            syncRoundData('endRound', endRound);
        }
    });
    endRoundPlus.addEventListener('click', () => {
        endRound++;
        endRoundDisplay.textContent = endRound;
        syncRoundData('endRound', endRound);
    });

    btnAddEndEnemy.addEventListener('click', () => {
        if (endEnemyCount >= 10) {
            alert("エネミー・部位は最大10体までです。");
            return;
        }
        endEnemyCount++;
        const enemyId = `end-enemy-${Date.now()}`;

        const card = document.createElement('div');
        card.className = 'enemy-card fade-in';
        card.id = enemyId;

        const isCoreChecked = endEnemyCount === 1 ? 'checked' : '';
        const isPartChecked = endEnemyCount === 1 ? '' : 'checked';
        const isZakoChecked = '';
        const defaultName = endEnemyCount === 1 ? 'ボス・コア' : `別部位 ${endEnemyCount - 1}`;

        card.innerHTML = `
            <div class="enemy-header">
                <div class="part-type-selector">
                    <label><input type="radio" name="part-type-${enemyId}" value="core" ${isCoreChecked}> コア</label>
                    <label><input type="radio" name="part-type-${enemyId}" value="part" ${isPartChecked}> 別部位</label>
                    <label><input type="radio" name="part-type-${enemyId}" value="zako" ${isZakoChecked}> 雑魚</label>
                </div>
                <button class="btn-remove" title="削除">×</button>
            </div>
            <div class="enemy-name-row">
                <input type="text" class="enemy-name" value="${defaultName}">
                <div class="part-status">
                    <label class="switch">
                        <input type="checkbox" class="part-active" checked>
                        <span class="slider round"></span>
                    </label>
                    <span class="status-label">オン</span>
                </div>
            </div>
            <div class="stat-row">
                <div class="stat-item">
                    <label>攻</label>
                    <input type="number" class="stat-input stat-kou" value="5" min="0">
                    <button class="btn-roll" data-stat="攻" data-target=".stat-kou">Roll</button>
                </div>
                <!-- 防御ペナルティに対応 -->
                <div class="stat-item">
                    <label>防<span class="penalty-disp penalty-badge"></span></label>
                    <input type="number" class="stat-input stat-bou" value="5" min="0">
                    <button class="btn-roll" data-stat="防" data-target=".stat-bou">Roll</button>
                    <!-- dataset代わり -->
                    <input type="hidden" class="hidden-defense-penalty" value="0">
                </div>
                <div class="stat-item">
                    <label>速</label>
                    <input type="number" class="stat-input stat-soku" value="5" min="0">
                    <button class="btn-roll" data-stat="速" data-target=".stat-soku">Roll</button>
                </div>
                <div class="stat-item">
                    <label>魅</label>
                    <input type="number" class="stat-input stat-mi" value="5" min="0">
                    <button class="btn-roll" data-stat="魅" data-target=".stat-mi">Roll</button>
                </div>
            </div>
            <div class="hp-section">
                <div class="hp-display">
                    <label>HP</label>
                    <input type="number" class="hp-input current-hp" value="50">
                </div>
                <div class="damage-control">
                    <input type="number" class="dmg-input" placeholder="ダメージ量" min="0">
                    <button class="btn-apply-dmg">適用</button>
                </div>
            </div>
        `;

        card.querySelector('.btn-remove').addEventListener('click', () => {
            card.remove();
            endEnemyCount--;
        });

        // ラジオボタンによる名前変更
        const radioBtns = card.querySelectorAll('input[type="radio"]');
        radioBtns.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const nameInput = card.querySelector('.enemy-name');
                if (e.target.value === 'core') nameInput.value = 'ボス・コア';
                if (e.target.value === 'part') nameInput.value = `別部位 ${endEnemyCount - 1}`;
                if (e.target.value === 'zako') nameInput.value = `雑魚 エネミー`;
            });
        });

        // 稼働スイッチ
        const activeCheck = card.querySelector('.part-active');
        const statusLabel = card.querySelector('.status-label');
        activeCheck.addEventListener('change', () => {
            statusLabel.textContent = activeCheck.checked ? 'オン' : 'オフ';
            if (!activeCheck.checked) card.style.opacity = '0.5';
            else card.style.opacity = '1';
        });

        // ダメージ適用
        const currentHpInput = card.querySelector('.current-hp');
        const dmgInput = card.querySelector('.dmg-input');
        card.querySelector('.btn-apply-dmg').addEventListener('click', () => {
            const dmg = parseInt(dmgInput.value) || 0;
            const currentHp = parseInt(currentHpInput.value) || 0;
            if (dmg > 0) {
                const newHp = Math.max(0, currentHp - dmg);
                currentHpInput.value = newHp;
                dmgInput.value = '';

                currentHpInput.style.color = 'var(--danger-color)';
                setTimeout(() => currentHpInput.style.color = 'var(--success-color)', 500);

                if (newHp === 0 && activeCheck.checked) {
                    const partType = card.querySelector('input[type="radio"]:checked')?.value;
                    const name = card.querySelector('.enemy-name').value;

                    if (partType === 'zako') {
                        showToast("システム", "雑魚撃破", 0, `${name} のHPが0になりました。`);
                    } else {
                        const typeStr = partType === 'core' ? 'コア' : '別部位';
                        showToast("システム", "部位破壊", 0, `${name} (${typeStr}) のHPが0になりました。<br>別部位の場合はラウンド終了処理でペナルティを発生させます。`);
                    }
                }
            }
        });

        // ダイスロール処理
        const rollerBtns = card.querySelectorAll('.btn-roll');
        const nameInput = card.querySelector('.enemy-name');
        rollerBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const statLabel = btn.getAttribute('data-stat');
                const statTarget = btn.getAttribute('data-target');
                let diceCount = parseInt(card.querySelector(statTarget).value) || 0;

                // 防御の場合ペナルティを反映
                if (statLabel === '防') {
                    const pen = parseInt(card.querySelector('.hidden-defense-penalty').value) || 0;
                    diceCount = Math.max(0, diceCount - pen);
                }

                rollDice(nameInput.value, statLabel, diceCount);
            });
        });

        endEnemyContainer.appendChild(card);
    });

    // ラウンド終了時の別部位破壊ペナルティ処理（毎ラウンド継続発生）
    btnEndRoundResolve.addEventListener('click', () => {
        const endCards = endEnemyContainer.querySelectorAll('.enemy-card');

        let cores = [];
        let destroyedPartsTotal = 0;

        endCards.forEach(card => {
            const partType = card.querySelector('input[type="radio"]:checked')?.value;
            const currentHp = parseInt(card.querySelector('.current-hp').value) || 0;
            const activeCheck = card.querySelector('.part-active');

            if (partType === 'core' && activeCheck.checked) {
                cores.push(card);
            } else if (partType === 'part') {
                if (currentHp === 0 && activeCheck.checked) {
                    activeCheck.checked = false;
                    card.querySelector('.status-label').textContent = 'オフ';
                    card.style.opacity = '0.5';
                    destroyedPartsTotal++;
                } else if (!activeCheck.checked) {
                    destroyedPartsTotal++;
                }
            }
        });

        if (destroyedPartsTotal > 0 && cores.length > 0) {
            cores.forEach(coreCard => {
                const hpInput = coreCard.querySelector('.current-hp');
                const penInput = coreCard.querySelector('.hidden-defense-penalty');
                const penDisp = coreCard.querySelector('.penalty-disp');
                const coreName = coreCard.querySelector('.enemy-name').value;

                // コアに継続ダメージ
                const dmgTotal = 2 * destroyedPartsTotal;
                let currentHp = parseInt(hpInput.value) || 0;
                let newHp = Math.max(0, currentHp - dmgTotal);
                hpInput.value = newHp;

                // 防御ペナルティ (オフ部位の総数と同値に設定。これ以上の蓄積を防ぐ)
                penInput.value = destroyedPartsTotal;
                penDisp.textContent = ` (-${destroyedPartsTotal})`;

                hpInput.style.color = 'var(--danger-color)';
                setTimeout(() => hpInput.style.color = 'var(--success-color)', 500);

                if (newHp === 0) {
                    showToast("システム", "コア破壊！", 0, `${coreName} のHPが0になりました！`);
                }
            });
            showToast("システム", "ラウンド終了処理", destroyedPartsTotal, `破壊済みの別部位効果が発生。<br>コアに計 ${destroyedPartsTotal * 2}ダメージ と 防御判定-${destroyedPartsTotal}ダイス を適用しました！`);
        } else if (cores.length === 0 && destroyedPartsTotal > 0) {
            showToast("システム", "ラウンド終了処理", 0, "破壊済みの別部位がありますが、稼働中のコアがありませんでした。");
        } else {
            showToast("システム", "ラウンド終了処理", 0, "現在オフになっている別部位はありません。");
        }

        // ラウンドを自動で進行させる
        endRound++;
        endRoundDisplay.textContent = endRound;
        syncRoundData('endRound', endRound);
    });

    // ---- テーブル行の選択・決定処理 ----
    function setupEventTableBehavior(tableId, btnConfirmId, btnResetId) {
        const table = document.getElementById(tableId);
        const btnConfirm = document.getElementById(btnConfirmId);
        const btnReset = document.getElementById(btnResetId);
        if (!table || !btnConfirm || !btnReset) return;

        const tbody = table.querySelector('tbody');
        const rows = tbody.querySelectorAll('tr');

        // 行のクリック（複数選択対応）
        rows.forEach(row => {
            row.addEventListener('click', () => {
                if (table.classList.contains('confirmed')) return; // 決定済なら無効

                // 選択状態をトグル
                row.classList.toggle('selected');

                // 表全体として1つでも選択されているか確認
                const anySelected = table.querySelectorAll('tr.selected').length > 0;

                if (anySelected) {
                    table.classList.add('has-selection');
                    btnConfirm.disabled = false;
                } else {
                    table.classList.remove('has-selection');
                    btnConfirm.disabled = true;
                }
            });
        });

        // 決定ボタン
        btnConfirm.addEventListener('click', () => {
            if (!table.classList.contains('has-selection')) return;

            table.classList.add('confirmed');
            btnConfirm.style.display = 'none';
            btnReset.style.display = 'inline-flex';
        });

        // 選び直すボタン
        btnReset.addEventListener('click', () => {
            table.classList.remove('confirmed');
            table.classList.remove('has-selection');
            rows.forEach(r => r.classList.remove('selected'));

            btnReset.style.display = 'none';
            btnConfirm.style.display = 'inline-flex';
            btnConfirm.disabled = true;
        });
    }

    setupEventTableBehavior('mid-event-table', 'btn-mid-event-confirm', 'btn-mid-event-reset');
    setupEventTableBehavior('end-event-table', 'btn-end-event-confirm', 'btn-end-event-reset');

    // ---- 汎用更新機能 ----
    function updateTablesBasedOnAL() {
        const al = state.al;

        // 導入フェイズ更新: 全体 AL+6, 項目ごと AL
        if (introOverallTarget) introOverallTarget.textContent = al + 6;
        if (introEachTarget) introEachTarget.textContent = al;
        calculateIntroTotal();

        // 中盤フェイズ更新: 2 + AL
        const midReq = 2 + al;
        midReqElements.forEach(el => {
            el.textContent = midReq;

            // アニメーション
            el.classList.remove('fade-in');
            void el.offsetWidth; // reflow
            el.classList.add('fade-in');
        });

        // 終盤フェイズ更新: 敵の最高能力値 4 + AL など
        const endReq = 4 + al;
        endReqElements.forEach(el => { el.textContent = endReq; });
        endReqCalc1Elements.forEach(el => { el.textContent = 2 + al; });
        endReqCalc2Elements.forEach(el => { el.textContent = 3 + al; });
        endReqCalc3Elements.forEach(el => { el.textContent = 1 + al; });

        console.log("AL Updated to:", al);
    }

    // 初回初期化
    updateTablesBasedOnAL();
});
