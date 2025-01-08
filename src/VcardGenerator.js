const chalk = require("chalk");
const path = require("path");
const inquirer = require("inquirer");
const readline = require("readline");
const fs = require("fs-extra");

/**
 * Fonction pour générer un fichier contenant les informations VCard.**
 * @param {string} vCard - Le contenu formaté de la VCard à écrire dans un fichier.
 */

async function generateVCardFile(vCard) {
    const dirPath = path.join(process.cwd(), './data');
    const VcardFilePath = path.join(dirPath, `Vcard-${new Date().toISOString().replace(/[:.]/g, "-")}.vcf`);
    console.log(VcardFilePath);
    try {
        await fs.ensureDir(dirPath); // S'assure que le répertoire "data" existe, sinon il le crée.
        // Écriture du fichier Vcard
        fs.writeFileSync(VcardFilePath, vCard, "utf8");
        console.log(chalk.green(`Fichier Vcard généré avec succès : ${VcardFilePath}`));
    } catch (error) {
        console.error(chalk.red("Erreur lors de la génération du fichier GIFT :"), error);
    }
}
/**
 * Fonction pour créer une VCard à partir des informations utilisateur collectées via des invites.**
 * @param {Object} contact - Objet contenant les informations initiales pour la VCard (par défaut vide).
 * @returns {string} - La VCard générée au format texte.
 */

async function generateVCard(contact = {
    name : "",
    surname : "",
    email : "",
    phone : NaN
}) {
const { name } = await inquirer.prompt([
    {
        type: "string",
        name: "name",
        message: `Name: `
    }]);
contact.name= name;
const { surname } = await inquirer.prompt([
    {
        type: "string",
        name: "surname",
        message: `Surname: `
    }]);
contact.surname= surname;
const { email } = await inquirer.prompt([
    {
        type: "string",
        name: "email",
        message: `E-mail: `
    }]);
contact.email= email;
const { phone } = await inquirer.prompt([
    {
        type: "number",
        name: "phone",
        message: `Phone number: `
    }]);
contact.phone= phone;

    const vCard = `BEGIN: VCARD\nVERSION: 4.0\nN: ${contact.name}\nSN: ${contact.surname}\nEMAIL: ${contact.email}\nTEL: ${contact.phone}\nEND: VCARD`

    await generateVCardFile(vCard);

    return vCard;
}

module.exports = {
    generateVCard // Exporte la fonction pour qu'elle soit utilisable dans d'autres fichiers.
};
