// Importer les modules
const path = require("path");
const fs = require("fs-extra");
const chalk = require("chalk");
const inquirer = require("inquirer");
const vega = require('vega');
const vegalite = require('vega-lite');
const puppeteer = require('puppeteer');

const examSet = new Set();
const limit = [3, 5]

const questionsPath = path.join(__dirname, "../data/questions.json");
profile = {}


async function selectQuestion() {
    console.log("Affichage d'une question sélectionnée...");
    try {
        // Charger les questions depuis le fichier JSON
        const questions = await fs.readJSON(questionsPath);

        if (questions.length === 0) {
            console.log(chalk.red("La banque de questions est vide."));
            return null;
        }

        // Afficher une liste des questions pour sélection
        const { selectedQuestion } = await inquirer.prompt([
            {
                type: "list",
                name: "selectedQuestion",
                message: "Sélectionnez une question à afficher :",
                choices: questions.map((q, index) => ({
                    name: isQuestionInSet(examSet, q)
                        ? chalk.red(`${index + 1}. ${q.title} [${q.type}]`)
                        : `${index + 1}. ${q.title} [${q.type}]`,
                    value: q, // On passe directement l'objet question sélectionné
                })),
            },
        ]);

        return selectedQuestion;
    } catch (error) {
        console.error(chalk.red("Erreur lors du chargement des questions :"), error);
        return null;
    }
}
async function selectNumberOfQuestions() {
    while (true) {
        const { numberOfQuestions } = await inquirer.prompt([
            {
                type: "number",
                name: "numberOfQuestions",
                message: `Combien de questions souhaitez-vous ajouter à l'examen ? (entre ${limit[0]} et ${limit[1]})`,
                validate: (value) => {
                    if (value >= limit[0] && value <= limit[1]) {
                        return true;
                    }
                    return `Veuillez entrer un nombre entre ${limit[0]} et ${limit[1]}.`;
                },
            },
        ]);

        if (numberOfQuestions >= limit[0] && numberOfQuestions <= limit[1]) {
            return numberOfQuestions;
        } else {
            console.log(chalk.red("Nombre invalide. Réessayez."));
        }
    }
}
async function makeExamGift() {
    const numberOfQuestions = await selectNumberOfQuestions();

    while (examSet.size < numberOfQuestions) {
        const selectedQuestion = await selectQuestion();
        if (selectedQuestion) {
            // Vérification avant d'ajouter l'élément pour éviter les doublons
            if (!isQuestionInSet(examSet, selectedQuestion)) {
                examSet.add(selectedQuestion);
                console.log(chalk.green("Question ajoutée à l'examen : ") + selectedQuestion.title);
            } else {
                console.log(chalk.yellow("La question est déjà présente dans l'examen."));
            }
        }

        console.log(
            chalk.blue(`Nombre de questions ajoutées : ${examSet.size}/${numberOfQuestions}`)
        );
    }

    console.log(chalk.green("\nToutes les questions ont été ajoutées à l'examen !"));
    console.log(
        chalk.blue("\nQuestions sélectionnées :"),
        Array.from(examSet).map((q) => q.title).join(", ")
    );

    // Si nécessaire, vous pouvez ensuite générer un fichier GIFT ici
    await generateGiftFile(examSet);
}
async function generateGiftFile(examSet) {
    if (examSet.size === 0) {
        console.log(chalk.red("Aucune question sélectionnée pour générer le fichier GIFT."));
        return;
    }

    // Chemin du fichier GIFT
    const dirPath = path.join(process.cwd(), 'data');
    const giftFilePath = path.join(
        dirPath,
        "exam - " + new Date().toISOString().replace(/[:.]/g, "-") + ".gift"
    );

    // Transformation des questions en format GIFT
    const giftContent = Array.from(examSet)
        .map((question, index) => {
            switch (question.type) {
                case "multiple_choice":
                    const multipleChoiceOptions = question.options
                        .map((option) => (option.is_correct ? `=${option.text}` : `~${option.text}`))
                        .join(" ");
                    return `::${question.title}:: ${question.question} { ${multipleChoiceOptions} }`;

                case "true_false":
                    return `::${question.title}:: ${question.question} { ${question.answer ? "T" : "F"} }`;

                case "short_answer":
                    const shortAnswers = question.correct_answers.map((ans) => `=${ans}`).join(" ");
                    return `::${question.title}:: ${question.question} { ${shortAnswers} }`;

                case "matching":
                    const matchingPairs = question.pairs
                        .map((pair) => `=${pair.term} -> ${pair.match}`)
                        .join(" ");
                    return `::${question.title}:: ${question.question} { ${matchingPairs} }`;

                case "cloze":
                    const clozeQuestion = question.answers.reduce((formatted, answer, index) => {
                        return formatted.replace(`(${index + 1})`, `{=${answer}}`);
                    }, question.question);
                    
                        return `::${question.title}:: ${clozeQuestion}`;

                case "numerical":
                    return `::${question.title}:: ${question.question} {#${question.correct_answer}:${question.tolerance}}`;

                case "multiple_choice_feedback":
                    const feedbackOptions = question.options.map((option) => {
                        const prefix = option.is_correct ? "=" : "~";
                        return `${prefix}${option.text}#${option.feedback}`;
                    }).join(" ");
                    return `::${question.title}:: ${question.question} { ${feedbackOptions} }`;
                case "open":
                    return `::${question.title}:: ${question.question} {}`;
                default:
                    console.log(chalk.yellow(`Type de question non pris en charge : ${question.type}`));
                    return null;
            }
        })
        .filter((content) => content !== null) // Filtrer les types inconnus
        .join("\n\n");

    try {
        await fs.ensureDir(dirPath);

        // Écriture du fichier GIFT
        await fs.writeFile(giftFilePath, giftContent, "utf8");
        console.log(chalk.green(`Fichier GIFT généré avec succès : ${giftFilePath}`));
    } catch (error) {
        console.error(chalk.red("Erreur lors de la génération du fichier GIFT :"), error);
    }
}
async function analyze(toAnalyze) {
    try {
        // Charger les questions depuis le fichier JSON
        console.log(chalk.red("Analyse des questions pour définir un profil d'examen..."));
        const questions = toAnalyze
        // const questions = await fs.readJSON(toAnalyze);dataToParse
        console.log(chalk.green("Questions chargées avec succès."));

        if (questions.length === 0) {
            console.log(chalk.red("La banque de questions est vide."));
            return null;
        }

        // Analyser les questions pour définir un profil d'examen
        questions.forEach(recognizeType)
        console.log(chalk.green("Profil d'examen défini avec succès."));
        // console.log(chalk.bgCyan(JSON.stringify(profile, null, 2)));
    } catch (error) {
        console.error(chalk.red("Erreur lors du chargement des questions :"), error);
    }

    
}
async function MenuAnalyze() {
    const directoryPath = path.resolve("./data"); // Use absolute path
    let parsedData = null;
    // Initialize the profile
    initProfile();

    try {
        // Select a file
        const filePath = await selectFile(directoryPath,'gift');
        if (!filePath) {
            console.log("No file selected. Exiting.");
            return;
        }

        console.log("Fichier sélectionné :", filePath);


        // Parse the selected file
        parsedData = await parser.parse(filePath, "./data/questions.json");
        
        console.log(parsedData)
        // dataToParse = await fs.readJSON("./data/questions.json");
        if (!parsedData) {
            console.log("No data to analyze. Exiting.");
            return;
        }

        // Analyze the questions to define an exam profile
        await analyze(parsedData);

        // Generate a chart specification
        const spec = {
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            description: "Question types and their counts",
            data: { values: prepareProfile(profile) },
            mark: "bar",
            encoding: {
                x: { field: "type", type: "ordinal", title: "Question Type" },
                y: { field: "count", type: "quantitative", title: "Number of Questions" },
                color: { field: "type", type: "nominal" },
            },
        };

        // Render the chart to both HTML and PDF
        await renderChartToHtml(spec);
        console.log("HTML chart generated successfully.");

        await renderChartToPdf(spec);
        console.log("PDF chart generated successfully.");
    } catch (error) {
        console.error("Error in MenuAnalyze:", error);
    }
}

// Render the chart to an HTML file
async function renderChartToHtml(spec) {
    const vegaView = new vega.View(vega.parse(vegalite.compile(spec).spec))
        .renderer('none')
        .initialize();
    const svg = await vegaView.toSVG(); // Generate SVG from the chart

    // Save SVG to a temporary HTML file
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>Chart</title></head>
        <body>${svg}</body>
        </html>
    `;
    const htmlPath = './chart.html';
    await fs.writeFile(htmlPath, htmlContent, 'utf8');


}
// Render the chart to a PDF file
async function renderChartToPdf() {
        // Step 4: Convert the HTML to a PDF using Puppeteer
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(`file://${process.cwd()}/chart.html`, { waitUntil: 'load' });
        await page.pdf({
            path: './data/chart '+ new Date().toISOString().replace(/[:.]/g, "-") +'.pdf',
            format: 'A4',
            printBackground: true,
        });
        await browser.close();
    
        console.log("PDF generated: chart.pdf");
}
async function selectFile(directory) {
    try {
        // Lister les fichiers dans le répertoire
        const files = await fs.readdir(directory);

        // Vérifier quels éléments sont des fichiers
        const fileList = [];
        for (const file of files) {
            const filePath = path.join(directory, file);
            const stat = await fs.stat(filePath);
            if (stat.isFile()) {
                fileList.push(file);
            }
        }

        // Si aucun fichier n'est trouvé
        if (fileList.length === 0) {
            console.log("Aucun fichier trouvé dans ce répertoire.");
            return null;
        }

        // Afficher les fichiers pour sélection
        const { selectedFile } = await inquirer.prompt([
            {
                type: "list",
                name: "selectedFile",
                message: "Sélectionnez un fichier :",
                choices: fileList,
            },
        ]);

        // Retourner le chemin complet du fichier sélectionné
        return path.join(directory, selectedFile);
    } catch (error) {
        console.error("Erreur lors de la lecture du répertoire :", error);
    }
}

//prepare profile for vegalite
function prepareProfile(profile) {
    const data = [];
    for (const [type, { count }] of Object.entries(profile)) {
        data.push({ type, count });
    }
    return data;
}
function isQuestionInSet(set, question) {
    return Array.from(set).some(
        (q) => JSON.stringify(q.title) === JSON.stringify(question.title)
    );
}
function recognizeType(question) {
    const toAdd = question.title;
    if (profile[question.type]) {
        profile[question.type].questions.push(toAdd); // Ajoute la question
        profile[question.type].count++; // Incrémente le compteur
    } else {
        console.log(chalk.red(`Type de question inconnu : ${question.type}`));
    }
}
function initProfile(){
    profile = {
        cloze: { count: 0, questions: [] },
        matching: { count: 0, questions: [] },
        multiple_choice: { count: 0, questions: [] },
        numerical: { count: 0, questions: [] },
        short_answer: { count: 0, questions: [] },
        true_false: { count: 0, questions: [] },
        multiple_choice_feedback: { count: 0, questions: [] },
        open: { count: 0, questions: [] },
    };
}
 //SPEC09 : Comparer le profil d'un examen avec le profil moyen d'un ou plusieurs fichiers de la banque de données.
async function compareExamProfile() {
    console.log(chalk.blue("=== Comparaison du profil d'examen avec la banque de données ==="));

    // Dresser le profil de l'examen
    console.log(chalk.blue("Étape 1 : Analyse du profil d'examen"));
    const examProfile = {};
    initProfile(); // Réinitialise le profil global
    await analyze(questionsPath); // Analyse les questions de l'examen
    Object.assign(examProfile, profile); // Copie le profil dans `examProfile`

    console.log(chalk.green("Profil de l'examen établi :"));
    console.log(chalk.bgCyan(JSON.stringify(examProfile, null, 2)));

    // Dresser le profil moyen de la banque de données
    console.log(chalk.blue("Étape 2 : Analyse des fichiers de la banque de données"));
    const directoryPath = path.join(__dirname, "../data"); // Répertoire contenant les fichiers
    const files = []; // Liste des fichiers sélectionnés pour analyse
    let averageProfile = {};
    initProfile(); // Réinitialise le profil global

    // Charger et analyser plusieurs fichiers
    while (true) {
        const selectedFile = await selectFile(directoryPath);
        if (!selectedFile) break; // Sort de la boucle si aucun fichier n'est sélectionné
        files.push(selectedFile);

        console.log(chalk.green("Analyse du fichier sélectionné :", selectedFile));
        await analyze(selectedFile);
    }

    // Calcul du profil moyen
    if (files.length > 0) {
        averageProfile = calculateAverageProfile(files.length);
        console.log(chalk.green("Profil moyen de la banque établi :"));
        console.log(chalk.bgCyan(JSON.stringify(averageProfile, null, 2)));
    } else {
        console.log(chalk.red("Aucun fichier n'a été sélectionné pour calculer le profil moyen."));
        return;
    }

    // Comparer les deux profils
    console.log(chalk.blue("Étape 3 : Comparaison des profils"));
    compareProfiles(examProfile, averageProfile);
}
function calculateAverageProfile(totalFiles) {
    const averageProfile = {};
    for (const [type, data] of Object.entries(profile)) {
        averageProfile[type] = {
            count: data.count / totalFiles,
            questions: [...data.questions], // On garde la liste des questions (optionnel)
        };
    }
    return averageProfile;
}
function compareProfiles(profile1, profile2) {
    console.log(chalk.blue("Comparaison des types de questions :"));
    for (const [type, data1] of Object.entries(profile1)) {
        const data2 = profile2[type] || { count: 0 };
        const difference = data1.count - data2.count;

        console.log(
            `${type.toUpperCase()}: Examen = ${data1.count}, Moyenne = ${data2.count.toFixed(2)}, Écart = ${difference.toFixed(2)}`
        );

        if (difference !== 0) {
            console.log(chalk.yellow(`L'examen contient un écart de ${difference} questions de type ${type}.`));
        }
    }
}

module.exports = {
    makeExamGift, MenuAnalyze, compareExamProfile,
};


    // // Optionnel : Enregistrez l'examen en fichier GIFT ou JSON
    // const outputPath = path.join(__dirname, "../output/exam.json");
    // await fs.writeJSON(outputPath, exam, { spaces: 2 });
    // console.log(chalk.green(`Examen sauvegardé dans : ${outputPath}`));