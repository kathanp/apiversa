package io.github.kathanp.apiversa.maven;

import java.io.File;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Writes one record per schema per date. */
@Mojo(name = "generate-client", requiresProject = true)
public class GenerateClientMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/src/main/resources/api-versions")
    private File dir;

    @Parameter(property = "apiversa.package", defaultValue = "apiversa.client.generated")
    private String packageName;

    @Parameter(property = "apiversa.lang")
    private String lang;

    @Override
    public void execute() throws MojoFailureException {
        try {
            for (java.nio.file.Path file : GenerateClient.write(dir.toPath(), packageName, lang)) getLog().info("wrote " + file);
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
