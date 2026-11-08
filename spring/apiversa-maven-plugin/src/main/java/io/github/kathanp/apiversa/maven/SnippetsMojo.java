package io.github.kathanp.apiversa.maven;

import java.io.File;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Writes the three DOC-08 snippet files. */
@Mojo(name = "snippets", requiresProject = true)
public class SnippetsMojo extends AbstractMojo {
    @Parameter(property = "apiversa.version", required = true)
    private String version;

    @Parameter(property = "apiversa.header", defaultValue = "Api-Version")
    private String header;

    @Parameter(defaultValue = "${project.basedir}")
    private File output;

    @Override
    public void execute() throws MojoFailureException {
        try {
            for (java.nio.file.Path file : Snippets.write(output.toPath(), version, header)) getLog().info("wrote " + file);
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
