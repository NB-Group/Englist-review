document.documentElement.classList.toggle('dark');
let originalFileName = "";

function message(text) {
    document.querySelector('#message').textContent = text;
    document.querySelector('#message').style.display = 'block';
}


document.addEventListener("DOMContentLoaded", function () {
    const fileInput = document.getElementById("file-input");
    const chineseText = document.getElementById("chinese-text");
    const answerInput = document.getElementById("answer-input");
    const errorList = document.getElementById("error-list");
    const errorItems = document.getElementById("error-items");
    let currentIndex = 0;
    let qaPairs = [];
    let wrongAnswers = []; // 存储错题
    let isRetryMode = false; // 标记是否在错题模式
    // 设置背景图片
    document.body.style.backgroundImage =
        "url(https://api.paugram.com/bing/)";

    function handleSubmit() {
        const userAnswer = answerInput.value.trim();
        const correctAnswer = qaPairs[currentIndex].english;

        // 定义要忽略的虚词
        const ignoreWords = ["the", "a", "an"];

        // 移除括号及其内容的函数
        const removeBrackets = (text) => {
            return text.replace(/\([^)]*\)/g, "").trim();
        };

        // 过滤函数：去除虚词、括号内容并转换为小写
        const filterAnswer = (text) => {
            const textWithoutBrackets = removeBrackets(text);
            return textWithoutBrackets
                .split(" ")
                .filter((word) => !ignoreWords.includes(word.toLowerCase()))
                .join(" ")
                .toLowerCase();
        };

        // 比较处理后的答案
        if (filterAnswer(userAnswer) === filterAnswer(correctAnswer)) {
            message("回答正确！");
        } else {
            // 检查是否包含连接词调换的情况
            const checkConnectedPhrases = (text1, text2) => {
                const andPattern = /(.+)\s+and\s+(.+)/i;
                const orPattern = /(.+)\s+or\s+(.+)/i;

                const match1And = text1.match(andPattern);
                const match2And = text2.match(andPattern);
                const match1Or = text1.match(orPattern);
                const match2Or = text2.match(orPattern);

                if (match1And && match2And) {
                    const [, part1a, part1b] = match1And;
                    const [, part2a, part2b] = match2And;
                    // 检查正序和反序
                    return (
                        (filterAnswer(part1a) === filterAnswer(part2a) &&
                            filterAnswer(part1b) === filterAnswer(part2b)) ||
                        (filterAnswer(part1a) === filterAnswer(part2b) &&
                            filterAnswer(part1b) === filterAnswer(part2a))
                    );
                }

                if (match1Or && match2Or) {
                    const [, part1a, part1b] = match1Or;
                    const [, part2a, part2b] = match2Or;
                    // 检查正序和反序
                    return (
                        (filterAnswer(part1a) === filterAnswer(part2a) &&
                            filterAnswer(part1b) === filterAnswer(part2b)) ||
                        (filterAnswer(part1a) === filterAnswer(part2b) &&
                            filterAnswer(part1b) === filterAnswer(part2a))
                    );
                }

                return false;
            };

            // 在 submit-button 的事件监听器中
            if (!checkConnectedPhrases(userAnswer, correctAnswer)) {
                // 首先计算 highlightedAnswer
                const correctWords = correctAnswer.split(" ");
                const userWords = userAnswer.split(" ");

                const highlightedAnswer = correctWords
                    .map((word, index) => {
                        const userWord = userWords[index] || "";
                        if (
                            ignoreWords.includes(word.toLowerCase()) ||
                            word.match(/^\(.*\)$/) ||
                            removeBrackets(userWord).toLowerCase() ===
                            removeBrackets(word).toLowerCase()
                        ) {
                            return word;
                        }
                        return `<span style="color: yellow">${word}</span>`;
                    })
                    .join(" ");

                wrongAnswers.push({
                    english: correctAnswer,
                    chinese: qaPairs[currentIndex].chinese,
                    userAnswer: userAnswer,  // 添加用户的错误答案
                    highlightedAnswer: highlightedAnswer  // 添加带高亮标记的答案
                });

                const errorItem = document.createElement("li");
                errorItem.innerHTML = `中文: ${qaPairs[currentIndex].chinese} - 正确答案: ${highlightedAnswer}`;
                errorItems.appendChild(errorItem);
                errorList.style.display = "block";
            }

            message(`回答错误！正确答案是：${correctAnswer}`);
        }
        currentIndex++;
        displayNext();
    }

    fileInput.addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (file && file.name.endsWith(".docx")) {
            originalFileName = file.name.replace(".docx", "");
            const reader = new FileReader();
            reader.onload = function (e) {
                const arrayBuffer = e.target.result;
                mammoth
                    .extractRawText({ arrayBuffer: arrayBuffer })
                    .then((result) => {
                        const lines = result.value.split("\n");
                        qaPairs = lines
                            .map((line) => {
                                const trimmedLine = line.trim();
                                // 更新正则表达式以包含更多特殊字符
                                const regex =
                                    /^([a-zA-Z\s\(\)\[\]\{\}\.,\-\'"]+)([\u4e00-\u9fa5]+)$/;
                                const match = trimmedLine.match(regex);

                                if (match) {
                                    // 清理英文部分可能的多余空格
                                    const english = match[1].replace(/\s+/g, " ").trim();
                                    const chinese = match[2].trim();

                                    // 验证提取的内容不为空
                                    if (english && chinese) {
                                        return { english, chinese };
                                    }
                                }
                                return null;
                            })
                            .filter((pair) => pair !== null);

                        if (qaPairs.length > 0) {
                            displayNext();
                        } else {
                            message(
                                "未找到有效的英文-中文对。请确保每行包含英文(可包含标点)后跟中文。"
                            );
                        }
                    })
                    .catch((err) => {
                        console.error("解析 .docx 文件时出错:", err);
                        message("解析文件时出错。");
                    });
            };
            reader.readAsArrayBuffer(file);
        } else {
            message("请选择一个 .docx 文件。");
        }
    });

    // 在 DOMContentLoaded 事件监听器中添加导出按钮的事件处理
    document.getElementById("export-button").addEventListener("click", function () {
        if (wrongAnswers.length === 0) {
            message("没有错题可以导出！");
            return;
        }

        const { Document, Paragraph, TextRun } = docx;

        const doc = new Document({
            sections: [{
                properties: {},
                children: wrongAnswers.map(qa => {
                    const parts = qa.highlightedAnswer.split(/<span style="color: yellow">|<\/span>/);
                    const runs = parts.map((part, index) => {
                        if (index % 2 === 1) { // 需要高亮的部分
                            return new TextRun({
                                text: part,
                                highlight: "yellow" // 设置背景色为黄色
                            });
                        }
                        return new TextRun({
                            text: part
                        });
                    });

                    return new Paragraph({
                        children: [
                            ...runs,
                            new TextRun({ text: ' - ' }),
                            new TextRun({ text: qa.chinese }),
                            new TextRun({ text: '\n用户答案: ' }),
                            new TextRun({ text: qa.userAnswer })
                        ]
                    });
                })
            }]
        });

        // 生成并下载文档
        Packer.toBlob(doc).then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${originalFileName}错题集.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            message("错题导出成功！");
        });
    });
    document.getElementById("export-button").addEventListener("click", function () {
        if (wrongAnswers.length === 0) {
            message("没有错题可以导出！");
            return;
        }

        // 创建文档内容
        const doc = new Document();
        wrongAnswers.forEach(qa => {
            doc.createParagraph(`${qa.english}${qa.chinese}`);
        });

        // 生成并下载文档
        Packer.toBlob(doc).then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "错题集.docx";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            message("错题导出成功！");
        });
    });
    // 添加重做错题按钮的事件监听器
    document
        .getElementById("retry-button")
        .addEventListener("click", function () {
            if (wrongAnswers.length === 0) {
                message("没有错题需要重做！");
                return;
            }

            isRetryMode = true;
            currentIndex = 0;
            qaPairs = [...wrongAnswers]; // 将错题数组复制给题目数组
            wrongAnswers = []; // 清空错题数组，准备记录新的错题
            errorItems.innerHTML = ""; // 清空错题列表显示
            displayNext();
        });

    // 修改 displayNext 函数
    function displayNext() {
        if (currentIndex < qaPairs.length) {
            chineseText.textContent = qaPairs[currentIndex].chinese;
            answerInput.value = "";
            answerInput.focus();
        } else {
            if (isRetryMode) {
                if (wrongAnswers.length === 0) {
                    message("恭喜！所有错题都已改正！");
                } else {
                    message(`还有 ${wrongAnswers.length} 道题需要继续练习！`);
                }
                isRetryMode = false;
            } else {
                message("已完成所有题目！");
            }
        }
    }
    document.getElementById("submit-button").addEventListener("click", handleSubmit);
    answerInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault(); // 阻止默认的回车换行
            handleSubmit();
        }
    });
});